/**
 * progressBar.js
 * Renders and animates progress bars and raw percentages.
 */

export class ProgressBar {
  /**
   * Renders the HTML template for a progress bar
   */
  static renderHTML(percent, completedCount, totalCount) {
    const safePercent = Math.min(Math.max(percent || 0, 0), 100);
    return `
      <div class="progress-container flex-col gap-xs">
        <div class="flex justify-between align-center">
          <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Completion</span>
          <span class="mono" style="font-size: 0.9rem; font-weight: 800; color: var(--primary);">${safePercent}%</span>
        </div>
        <div class="bar-track" style="height: 8px; width: 100%; background-color: var(--border); border-radius: var(--radius-full); overflow: hidden; position: relative;">
          <div class="bar-fill" style="width: ${safePercent}%; height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent)); border-radius: var(--radius-full); transition: width 0.4s var(--ease-out);"></div>
        </div>
        ${completedCount !== undefined && totalCount !== undefined ? `
          <span style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 500;">
            ${completedCount} of ${totalCount} fields completed
          </span>
        ` : ''}
      </div>
    `;
  }

  /**
   * Updates an existing progress bar's fill width and text content in real-time
   */
  static updateDOM(containerEl, percent, completedCount, totalCount) {
    if (!containerEl) return;
    const safePercent = Math.min(Math.max(percent || 0, 0), 100);
    
    const fill = containerEl.querySelector('.bar-fill');
    const textPercent = containerEl.querySelector('.mono');
    const textCount = containerEl.querySelector('span:last-child');

    if (fill) fill.style.width = `${safePercent}%`;
    if (textPercent) textPercent.textContent = `${safePercent}%`;
    if (textCount && completedCount !== undefined && totalCount !== undefined) {
      textCount.textContent = `${completedCount} of ${totalCount} fields completed`;
    }
  }
}

export default ProgressBar;
