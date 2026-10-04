/**
 * apiProvider.js
 * API Storage Provider — server is the only session store (no LocalStorage fallback).
 */

const API_FETCH = {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' }
};

export class ApiProvider {
  constructor() {
    this.listeners = new Map();
    this.globalListeners = new Set();
  }

  async createSession(session) {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      ...API_FETCH,
      body: JSON.stringify(session)
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      if (response.status === 401 && !window.location.pathname.includes('/deposit/')) {
        window.location.href = '/login/index.html';
        throw new Error('Unauthorized');
      }
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      throw new Error(`createSession failed: HTTP ${response.status}`);
    }
    return await response.json();
  }

  async updateSession(id, updateData) {
    const response = await fetch(`/api/sessions/${id}`, {
      method: 'PUT',
      ...API_FETCH,
      body: JSON.stringify(updateData)
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      throw new Error(`updateSession failed: HTTP ${response.status}`);
    }
    return await response.json();
  }

  async deleteSession(id) {
    const response = await fetch(`/api/sessions/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error(`deleteSession failed: HTTP ${response.status}`);
    }
    return true;
  }

  async getSession(id) {
    const response = await fetch(`/api/sessions/${id}`, { credentials: 'include' });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`API session ${id} not found (404).`);
        return null;
      }
      throw new Error(`API returned status ${response.status}`);
    }
    if (contentType.includes('text/html')) {
      throw new Error('API returned HTML instead of JSON');
    }
    return await response.json();
  }

  async listSessions() {
    const response = await fetch('/api/sessions', { credentials: 'include' });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || contentType.includes('text/html')) {
      if (response.status === 401 || response.status === 403) {
        if (!window.location.pathname.includes('/deposit/')) {
          window.location.href = '/login/index.html';
        }
        return [];
      }
      throw new Error(`API listSessions failed with status ${response.status}`);
    }
    return await response.json();
  }

  subscribe(id, callback) {
    if (!this.listeners.has(id)) {
      this.listeners.set(id, new Set());
    }
    this.listeners.get(id).add(callback);

    this.getSession(id).then((session) => {
      if (session) callback(session);
    }).catch((e) => {
      console.error('Initial getSession failed:', e);
    });

    const intervalId = setInterval(async () => {
      try {
        const session = await this.getSession(id);
        if (session) callback(session);
      } catch (e) {
        console.error('Polling getSession failed:', e);
      }
    }, 2000);

    return () => {
      const callbacks = this.listeners.get(id);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) this.listeners.delete(id);
      }
      clearInterval(intervalId);
    };
  }

  subscribeAll(callback) {
    this.globalListeners.add(callback);

    this.listSessions().then((sessions) => {
      if (sessions) callback(sessions);
    }).catch((e) => {
      console.error('Initial listSessions failed:', e);
    });

    const intervalId = setInterval(async () => {
      try {
        const sessions = await this.listSessions();
        if (sessions) callback(sessions);
      } catch (e) {
        console.error('Polling listSessions failed:', e);
      }
    }, 2000);

    return () => {
      this.globalListeners.delete(callback);
      clearInterval(intervalId);
    };
  }
}
