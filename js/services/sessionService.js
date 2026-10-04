/**
 * sessionService.js
 * Business logic service managing session objects, updates, timeline tracking, and heartbeats.
 */

import { storage } from '../providers/storageProvider.js';
import { createDefaultSession, CONFIG, SESSION_STATUS } from '../utils/constants.js';

class SessionService {
  /**
   * Creates a brand new, unassigned session and saves it
   */
  async createNewSession(sessionId, agentName, priority, clientData = null, campaignName = null, agentId = null) {
    const session = createDefaultSession(sessionId, agentName, priority);
    if (clientData) session.client = clientData;
    if (campaignName) session.campaignName = campaignName;
    if (agentId) session.agentId = agentId;
    return await storage.createSession(session);
  }

  /** Persist a fully built session document (link metadata, flags, etc.). */
  async createSessionFromPayload(session) {
    return await storage.createSession(session);
  }

  /**
   * Retrieves a single session by its unique ID
   */
  async getSession(sessionId) {
    return await storage.getSession(sessionId);
  }

  /**
   * Deletes a session by its unique ID
   */
  async deleteSession(sessionId) {
    return await storage.deleteSession(sessionId);
  }

  /**
   * Lists all existing sessions
   */
  async listSessions() {
    return await storage.listSessions();
  }

  /**
   * Updates any portion of a session, automatically updating the updatedAt timestamp
   */
  async updateSession(sessionId, updateData) {
    return await storage.updateSession(sessionId, updateData);
  }

  /**
   * Adds an event to the session's timeline array and saves it
   */
  async logTimelineEvent(sessionId, eventName) {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const timeline = session.timeline || [];
    timeline.push({
      event: eventName,
      timestamp: Date.now()
    });

    return await this.updateSession(sessionId, { timeline });
  }

  /**
   * Subscribes to changes on a single session (real-time)
   */
  subscribeToSession(sessionId, callback) {
    return storage.subscribe(sessionId, callback);
  }

  /**
   * Subscribes to changes on ALL sessions (real-time)
   */
  subscribeToAllSessions(callback) {
    return storage.subscribeAll(callback);
  }

  /**
   * Broadcasts a heartbeat from the client deposit page to signify that they are still active
   */
  async sendHeartbeat(sessionId) {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const currentStatus = session.status;
    let newStatus = currentStatus;

    // If client was marked disconnected or offline, bring them back to opened/active
    if (currentStatus === SESSION_STATUS.DISCONNECTED || session.connection === 'offline') {
      newStatus = session.progress.percent > 0 ? SESSION_STATUS.ACTIVE : SESSION_STATUS.OPENED;
      this.logTimelineEvent(sessionId, 'Client Reconnected');
    }

    return await this.updateSession(sessionId, {
      status: newStatus,
      connection: 'online',
      updatedAt: Date.now()
    });
  }

  /**
   * Checks all sessions and marks stale ones (no update in last 15s) as disconnected/offline
   */
  async checkStaleSessions(sessions) {
    if (CONFIG.STORAGE_PROVIDER === 'api') {
      // The secure full-stack server handles staleness checks using the server system clock
      // to 100% eliminate any browser clock-drift issues.
      return;
    }
    const now = Date.now();
    for (const session of sessions) {
      if (session.connection === 'online' && (now - session.updatedAt) > CONFIG.OFFLINE_THRESHOLD_MS) {
        let newStatus = session.status;
        if (session.status !== SESSION_STATUS.COMPLETED && session.status !== SESSION_STATUS.SUBMITTED) {
          newStatus = SESSION_STATUS.DISCONNECTED;
        }
        
        await this.updateSession(session.id, {
          status: newStatus,
          connection: 'offline'
        });
        await this.logTimelineEvent(session.id, 'Client Connection Lost (Offline)');
      }
    }
  }
}

export const sessionService = new SessionService();
export default sessionService;
