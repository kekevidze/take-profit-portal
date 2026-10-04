/**
 * sessionCard.js
 * Renders an interactive sidebar session card with live connection states and session status.
 */

import { StatusBadge } from './statusBadge.js';
import { escapeHTML } from '../utils/helpers.js';

export class SessionCard {
  /**
   * Renders the complete HTML for a single session card item
   */
  static renderHTML(session, isActive = false) {
    const isOnline = session.connection === 'online';
    const client = session.client || {};
    const fullName = `${(client.firstName || '').trim()} ${(client.lastName || '').trim()}`.trim();
    const identifier = fullName || (client.email || '').trim() || session.id;
    const nameLabel = escapeHTML(identifier);
    const agentLabel = escapeHTML(session.agent || 'Unassigned');
    const attention = session.status === 'Ready' || session.status === 'Submitted';
    const rowClass = [
      isActive ? 'active' : '',
      session.status === 'Completed' ? 'completed' : '',
      isOnline ? 'session-row-online' : '',
      attention ? 'session-row-attention' : ''
    ].filter(Boolean).join(' ');

    return `
      <div class="card card-hover session-card ${rowClass}" data-id="${session.id}">
        <div class="session-row-main">
          <div class="flex align-center gap-xs session-row-title-line">
            <span class="live-dot ${isOnline ? '' : 'offline-dot'}" title="${isOnline ? 'Online' : 'Offline'}"></span>
            <span class="text-truncate session-row-title">${nameLabel}</span>
          </div>
          <div class="session-row-meta text-truncate">${agentLabel}</div>
        </div>
        <div class="session-row-trailing">
          ${StatusBadge.renderHTML(session.status)}
        </div>
      </div>
    `;
  }
}

export default SessionCard;

