import cron, { type ScheduledTask } from 'node-cron';
import { XeroSyncService } from './XeroSyncService.js';

/**
 * Schedules automated Xero data syncs via node-cron.
 * Default schedule: daily at 6:00 AM server time (AEST).
 *
 * Does NOT auto-start -- must be explicitly started via
 * API route or server bootstrap.
 */
class XeroSchedulerService {
  private task: ScheduledTask | null = null;
  private cronExpression = '0 6 * * *'; // Default: daily at 6am

  /**
   * Start the scheduled sync task.
   * @param expression cron expression (default: '0 6 * * *' -- daily at 6am AEST)
   */
  start(expression?: string): void {
    if (this.task) {
      console.log('[XeroScheduler] Scheduler already running, stopping first');
      this.stop();
    }

    if (expression) {
      if (!cron.validate(expression)) {
        throw new Error(`Invalid cron expression: ${expression}`);
      }
      this.cronExpression = expression;
    }

    console.log(`[XeroScheduler] Starting with schedule: ${this.cronExpression}`);

    this.task = cron.schedule(this.cronExpression, async () => {
      console.log(`[XeroScheduler] Running scheduled sync at ${new Date().toISOString()}`);
      try {
        const syncService = XeroSyncService.getInstance();
        // Sync current week ending (most recent Saturday)
        const results = await syncService.syncAll();
        const successCount = results.filter((r) => r.status === 'success').length;
        const failCount = results.filter((r) => r.status === 'failed').length;
        console.log(
          `[XeroScheduler] Sync complete: ${successCount} succeeded, ${failCount} failed`
        );
      } catch (error) {
        console.error('[XeroScheduler] Sync failed:', error);
      }
    });
  }

  /**
   * Stop the scheduled sync task.
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[XeroScheduler] Scheduler stopped');
    }
  }

  /**
   * Returns whether the scheduler is currently running.
   */
  isRunning(): boolean {
    return this.task !== null;
  }

  /**
   * Returns the current cron expression.
   */
  getCronExpression(): string {
    return this.cronExpression;
  }
}

// Export singleton instance
export const XeroScheduler = new XeroSchedulerService();
