/**
 * localProvider.js
 * LocalStorage Provider with real-time multi-tab synchronization.
 * Follows SOLID principles, implementing the unified StorageProvider interface.
 */

import { CONFIG } from '../utils/constants.js';

export class LocalProvider {
  constructor() {
    this.storageKey = CONFIG.LOCAL_STORAGE_KEY;
    this.listeners = new Map(); // sessionId -> Set of callbacks
    this.globalListeners = new Set(); // Callbacks for all sessions

    // Cross-tab synchronization via storage events
    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey) {
        this._notifyListeners();
      }
    });
  }

  _getRawData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('Failed to read from LocalStorage:', e);
      return {};
    }
  }

  _saveRawData(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      // Manually trigger notification for the same tab
      this._notifyListeners();
    } catch (e) {
      console.error('Failed to write to LocalStorage:', e);
    }
  }

  _notifyListeners() {
    const data = this._getRawData();
    const sessionsList = Object.values(data);

    // Notify global listeners
    this.globalListeners.forEach(cb => {
      try { cb(sessionsList); } catch (e) { console.error(e); }
    });

    // Notify session-specific listeners
    this.listeners.forEach((callbacks, sessionId) => {
      const session = data[sessionId];
      if (session) {
        callbacks.forEach(cb => {
          try { cb(session); } catch (e) { console.error(e); }
        });
      }
    });
  }

  async createSession(session) {
    const data = this._getRawData();
    data[session.id] = session;
    this._saveRawData(data);
    return session;
  }

  async updateSession(id, updateData) {
    const data = this._getRawData();
    if (!data[id]) return null;
    
    // Perform a deep or shallow merge
    data[id] = {
      ...data[id],
      ...updateData,
      updatedAt: Date.now()
    };
    
    this._saveRawData(data);
    return data[id];
  }

  async deleteSession(id) {
    const data = this._getRawData();
    if (data[id]) {
      delete data[id];
      this._saveRawData(data);
      return true;
    }
    return false;
  }

  async getSession(id) {
    const data = this._getRawData();
    return data[id] || null;
  }

  async listSessions() {
    const data = this._getRawData();
    return Object.values(data);
  }

  subscribe(id, callback) {
    if (!this.listeners.has(id)) {
      this.listeners.set(id, new Set());
    }
    this.listeners.get(id).add(callback);

    // Initial trigger
    this.getSession(id).then(session => {
      if (session) callback(session);
    });

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(id);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(id);
        }
      }
    };
  }

  subscribeAll(callback) {
    this.globalListeners.add(callback);

    // Initial trigger
    this.listSessions().then(sessions => callback(sessions));

    // Return unsubscribe function
    return () => {
      this.globalListeners.delete(callback);
    };
  }
}
