/**
 * storageProvider.js
 * Unified Storage Provider — API backend only.
 */

import { ApiProvider } from './apiProvider.js';

class StorageProvider {
  constructor() {
    this.provider = new ApiProvider();
    console.log('Active Storage Provider: API');
  }

  async createSession(session) {
    return await this.provider.createSession(session);
  }

  async updateSession(id, updateData) {
    return await this.provider.updateSession(id, updateData);
  }

  async deleteSession(id) {
    return await this.provider.deleteSession(id);
  }

  async getSession(id) {
    return await this.provider.getSession(id);
  }

  async listSessions() {
    return await this.provider.listSessions();
  }

  subscribe(id, callback) {
    return this.provider.subscribe(id, callback);
  }

  subscribeAll(callback) {
    return this.provider.subscribeAll(callback);
  }
}

export const storage = new StorageProvider();
export default storage;
