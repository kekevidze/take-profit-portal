/**
 * broadcastProvider.js
 * Native BroadcastChannel Provider for ultra-fast, local, cross-tab, real-time message broadcasting.
 * Fully compatible with our unified RealtimeProvider interface.
 */

export class BroadcastProvider {
  constructor() {
    this.channels = new Map(); // name -> BroadcastChannel instance
    this.subscriptions = new Map(); // name -> Set of callbacks
  }

  connect() {
    console.log('BroadcastProvider: Real-time channel active.');
  }

  disconnect() {
    this.channels.forEach(ch => {
      try { ch.close(); } catch (e) { console.error(e); }
    });
    this.channels.clear();
    this.subscriptions.clear();
    console.log('BroadcastProvider: Disconnected all channels.');
  }

  _getOrCreateChannel(name) {
    if (!this.channels.has(name)) {
      try {
        const channel = new BroadcastChannel(name);
        channel.onmessage = (event) => {
          this._handleMessage(name, event.data);
        };
        this.channels.set(name, channel);
      } catch (error) {
        console.error(`Failed to create BroadcastChannel on "${name}":`, error);
        return null;
      }
    }
    return this.channels.get(name);
  }

  _handleMessage(channelName, data) {
    const callbacks = this.subscriptions.get(channelName);
    if (callbacks) {
      callbacks.forEach(cb => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    }
  }

  subscribe(channelName, callback) {
    if (!this.subscriptions.has(channelName)) {
      this.subscriptions.set(channelName, new Set());
    }
    this.subscriptions.get(channelName).add(callback);
    this._getOrCreateChannel(channelName);

    return () => {
      const callbacks = this.subscriptions.get(channelName);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(channelName);
          const channel = this.channels.get(channelName);
          if (channel) {
            channel.close();
            this.channels.delete(channelName);
          }
        }
      }
    };
  }

  publish(channelName, message) {
    const channel = this._getOrCreateChannel(channelName);
    if (channel) {
      try {
        channel.postMessage(message);
        // Also invoke callbacks in the current tab/thread so the publisher is immediately synchronized
        this._handleMessage(channelName, message);
        return true;
      } catch (error) {
        console.error(`Failed to post message on channel "${channelName}":`, error);
      }
    }
    return false;
  }
}
