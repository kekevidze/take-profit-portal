/**
 * constants.js
 * Centralized application configuration, states, schemas, and static data.
 */

export const CONFIG = {
  STORAGE_PROVIDER: 'api',
  REALTIME_PROVIDER: 'broadcast',
  LOCAL_STORAGE_KEY: 'portal_sessions_v1',

  // Heartbeat / Connection Staleness Windows
  HEARTBEAT_INTERVAL_MS: 5000,
  OFFLINE_THRESHOLD_MS: 15000,

  // Audio alert settings
  NOTIFICATION_SOUND_URL: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav', // Premium soft notification chime
};

export const SESSION_STATUS = {
  WAITING: 'Waiting',           // Link generated, client hasn't opened yet
  OPENED: 'Opened',             // Client opened page
  ACTIVE: 'Active',             // Client has focused at least one field
  TYPING: 'Typing',             // Client actively typing
  READY: 'Ready',               // All form fields validated, ready for payment
  SUBMITTED: 'Submitted',       // Credit card submitted, processing
  COMPLETED: 'Completed',       // Successful deposit
  CANCELLED: 'Cancelled',       // Client clicked cancel / close
  EXPIRED: 'Expired',           // Session past valid window
  DISCONNECTED: 'Disconnected', // Client connection lost
};

export const PRIORITY = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low'
};

/** @deprecated Prefer ALL_COUNTRIES / countryCatalog helpers — kept for existing imports. */
export { ALL_COUNTRIES as COUNTRIES } from './countryCatalog.js';

/**
 * Helper to generate a blank default session object
 */
export function createDefaultSession(id, agent = 'Unassigned', priority = PRIORITY.MEDIUM) {
  const timestamp = Date.now();
  const linkId = 'LNK-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  return {
    id: id,
    agent: agent,
    priority: priority,
    status: SESSION_STATUS.WAITING,
    createdAt: timestamp,
    updatedAt: timestamp,
    connection: 'offline',
    campaignName: 'Place Order',
    client: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      country: '',
      city: '',
      notes: ''
    },
    payment: {
      brand: '',
      digitCount: 0,
      expiryValid: false,
      cvvCompleted: false,
      status: 'Not Started', // 'Not Started', 'In Progress', 'Card Complete', 'Complete' (paid)
      validity: 'Empty' // 'Empty', 'Valid', 'Invalid'
    },
    progress: {
      completed: 0,
      total: 9,
      percent: 0
    },
    activity: 'Waiting for client to open link...',
    timeline: [
      { event: 'Session Created', timestamp: timestamp }
    ],
    link: {
      id: linkId,
      createdAt: timestamp,
      status: 'Active',
      autoDetectCountryByIp: false
    }
  };
}
