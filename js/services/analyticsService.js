/**
 * analyticsService.js
 * Computes business intelligence KPIs, completion averages, and workload metrics from live sessions.
 */

import { SESSION_STATUS, PRIORITY } from '../utils/constants.js';

class AnalyticsService {
  /**
   * Processes the entire sessions list and returns live KPI cards data
   */
  getOverviewMetrics(sessions) {
    const total = sessions.length;
    let active = 0;
    let completed = 0;
    let sumProgress = 0;
    let highPriorityCount = 0;

    sessions.forEach(s => {
      sumProgress += (s.progress && s.progress.percent) || 0;
      if (s.connection === 'online') active++;
      if (s.status === SESSION_STATUS.COMPLETED) completed++;
      if (s.priority === PRIORITY.HIGH) highPriorityCount++;
    });

    const avgProgress = total > 0 ? Math.round(sumProgress / total) : 0;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      totalSessions: total,
      activeSessions: active,
      completedSessions: completed,
      avgProgressPercent: avgProgress,
      successRatePercent: successRate,
      highPrioritySessions: highPriorityCount
    };
  }

  /**
   * Group sessions by Assigned Agent to see workload distribution
   */
  getAgentDistribution(sessions) {
    const counts = {};
    sessions.forEach(s => {
      const agent = s.agent || 'Unassigned';
      counts[agent] = (counts[agent] || 0) + 1;
    });
    return counts;
  }

  /**
   * Group sessions by Country
   */
  getCountryDistribution(sessions) {
    const counts = {};
    sessions.forEach(s => {
      const country = (s.client && s.client.country) || 'Unknown';
      counts[country] = (counts[country] || 0) + 1;
    });
    return counts;
  }

  /**
   * Group sessions by Status
   */
  getStatusDistribution(sessions) {
    const counts = {};
    sessions.forEach(s => {
      const status = s.status || 'Unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
