/**
 * timeline.js
 * Renders the live interactive timeline audit trail of client activities on the dashboard.
 */

import { formatDateTime } from '../utils/formatters.js';
import { escapeHTML } from '../utils/helpers.js';

export class Timeline {
  /**
   * Generates a fully compiled HTML string of the session's activity timeline
   */
  static renderHTML(timelineData) {
    if (!timelineData || timelineData.length === 0) {
      return `
        <div class="text-center text-tertiary" style="padding: var(--spacing-lg) 0;">
          No timeline events recorded yet.
        </div>
      `;
    }

    // Sort timeline so latest events are at the top
    const sorted = [...timelineData].sort((a, b) => b.timestamp - a.timestamp);

    return `
      <div class="timeline-container" style="display: flex; flex-direction: column; position: relative;">
        ${sorted.map((item, idx) => {
          const isLatest = idx === 0;
          let colorClass = isLatest ? 'active' : '';
          
          if (item.event.toLowerCase().includes('fail') || item.event.toLowerCase().includes('lost')) {
            colorClass = 'error';
          } else if (item.event.toLowerCase().includes('success') || item.event.toLowerCase().includes('completed') || item.event.toLowerCase().includes('submit')) {
            colorClass = 'success';
          }

          const escapedEvent = escapeHTML(item.event);

          return `
            <div class="timeline-card ${colorClass}">
              <div class="flex justify-between align-center" style="margin-bottom: 2px;">
                <h4 style="font-size: 0.9rem; font-weight: 600; color: ${isLatest ? 'var(--text-primary)' : 'var(--text-secondary)'};">
                  ${escapedEvent}
                </h4>
                <span class="mono" style="font-size: 0.75rem; color: var(--text-tertiary);">
                  ${formatDateTime(item.timestamp)}
                </span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
}

export default Timeline;
