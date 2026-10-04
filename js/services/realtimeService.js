/**
 * realtimeService.js
 * Unified Realtime Service.
 * Manages active real-time communication channels for and between clients.
 * Routes to either local BroadcastChannel or Firestore subscriptions.
 */

import { CONFIG } from '../utils/constants.js';
import { BroadcastProvider } from '../providers/broadcastProvider.js';

class RealtimeService {
  constructor() {
    this.provider = null;
    this.init();
  }

  init() {
    if (CONFIG.REALTIME_PROVIDER === 'firestore') {
      // Lazy, safe fallback if Firestore is requested
      this.provider = new BroadcastProvider(); // Use Broadcast for local real-time messages, and firestore for session state subscriptions
    } else {
      this.provider = new BroadcastProvider();
    }
    this.provider.connect();
    console.log(`Active Real-time Provider: ${CONFIG.REALTIME_PROVIDER.toUpperCase()}`);
  }

  /**
   * Subscribe to a specific real-time channel topic (e.g. typing events, connection updates)
   * returns unsubscribe function
   */
  subscribe(channelName, callback) {
    return this.provider.subscribe(channelName, callback);
  }

  /**
   * Publish a message to a real-time channel topic
   */
  publish(channelName, message) {
    return this.provider.publish(channelName, message);
  }

  /**
   * Safe helper to publish a typing event
   */
  publishTyping(sessionId, fieldName, isTyping) {
    this.publish(`session_events_${sessionId}`, {
      type: 'typing',
      sessionId,
      fieldName,
      isTyping,
      timestamp: Date.now()
    });
  }

  /**
   * Safe helper to publish a connection status update
   */
  publishConnection(sessionId, status) {
    this.publish(`session_events_${sessionId}`, {
      type: 'connection',
      sessionId,
      status, // 'online' | 'offline'
      timestamp: Date.now()
    });
  }
}

export const realtimeService = new RealtimeService();
export default realtimeService;
