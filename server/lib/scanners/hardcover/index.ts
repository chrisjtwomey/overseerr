import Hardcover from '@server/api/hardcover';
import type {
  RunnableScanner,
  StatusBase,
} from '@server/lib/scanners/baseScanner';
import BaseScanner from '@server/lib/scanners/baseScanner';
import { getSettings } from '@server/lib/settings';

type SyncStatus = StatusBase;

class HardcoverCacheSync
  extends BaseScanner<null>
  implements RunnableScanner<SyncStatus>
{
  private hardcover: Hardcover;
  private maxRetries = 3;
  private retryDelay = 5000; // milliseconds

  public constructor() {
    super('Hardcover Cache Sync', { bundleSize: 50 });
  }

  public status(): SyncStatus {
    return {
      running: this.running,
      progress: this.progress,
      total: this.totalSize ?? 0,
    };
  }

  public async run(): Promise<void> {
    const settings = getSettings();
    const sessionId = this.startRun();
    try {
      this.hardcover = new Hardcover({
        token: settings.hardcover.token,
        cachePolicy: 'network-only',
      });

      this.log(`Beginning to refresh Hardcover metadata cache`, 'info');

      let retryCount = 0;
      let page = 1;
      let maxPages = 3;
      while (retryCount < this.maxRetries && page <= maxPages) {
        await this.hardcover
          .getDiscoverBooks({
            releaseDateGte: '2000-01-01',
            releaseDateLte: new Date().toISOString().split('T')[0],
            page,
          })
          .then((response) => {
            this.log(`Fetched page ${page} of Discover books`, 'info', {
              page,
              totalPages: response.total_pages,
              totalResults: response.total_results,
            });
            this.progress = response.page;
            this.totalSize = response.total_pages;
            this.running = true;

            retryCount = 0; // Reset retry count on success
            page++;
          })
          .catch(async (error) => {
            this.log(`Error fetching page ${page} of Discover books`, 'error', {
              errorMessage: error.message,
            });

            retryCount++;
            if (retryCount < this.maxRetries) {
              this.log(
                `Retrying in ${this.retryDelay / 1000} seconds...`,
                'info'
              );
              await new Promise((resolve) =>
                setTimeout(resolve, this.retryDelay)
              );
            }
          });
      }

      retryCount = 0;
      page = 1;
      maxPages = 3;
      while (retryCount < this.maxRetries && page <= maxPages) {
        await this.hardcover
          .getTrendingBooks({
            page,
          })
          .then((response) => {
            this.log(`Fetched page ${page} of Trending books`, 'info', {
              page,
              totalPages: response.total_pages,
              totalResults: response.total_results,
            });
            this.progress = response.page;
            this.totalSize = response.total_pages;
            this.running = true;

            retryCount = 0; // Reset retry count on success
            page++;
          })
          .catch(async (error) => {
            this.log(`Error fetching page ${page} of Trending books`, 'error', {
              errorMessage: error.message,
            });

            retryCount++;
            if (retryCount < this.maxRetries) {
              this.log(
                `Retrying in ${this.retryDelay / 1000} seconds...`,
                'info'
              );
              await new Promise((resolve) =>
                setTimeout(resolve, this.retryDelay)
              );
            }
          });
      }

      const now = new Date();
      const offset = now.getTimezoneOffset();
      const date = new Date(now.getTime() - offset * 60 * 1000)
        .toISOString()
        .split('T')[0];

      retryCount = 0;
      page = 1;
      maxPages = 1;
      while (retryCount < this.maxRetries && page <= maxPages) {
        await this.hardcover
          .getDiscoverBooks({
            releaseDateGte: date,
            page: page,
            sortBy: 'popularity.desc',
          })
          .then((response) => {
            this.log(`Fetched page ${page} of Upcoming books`, 'info', {
              page,
              totalPages: response.total_pages,
              totalResults: response.total_results,
            });
            this.progress = response.page;
            this.totalSize = response.total_pages;
            this.running = true;

            retryCount = 0; // Reset retry count on success
            page++;
          })
          .catch(async (error) => {
            this.log(`Error fetching page ${page} of Upcoming books`, 'error', {
              errorMessage: error.message,
            });

            retryCount++;
            if (retryCount < this.maxRetries) {
              this.log(
                `Retrying in ${this.retryDelay / 1000} seconds...`,
                'info'
              );
              await new Promise((resolve) =>
                setTimeout(resolve, this.retryDelay)
              );
            }
          });
      }

      settings.hardcover.lastScan = Date.now();
      settings.save();

      this.log('Cache refresh Complete', 'info');
    } catch (e) {
      this.log('Cache refresh interrupted', 'error', {
        errorMessage: e.message,
      });
    } finally {
      this.endRun(sessionId);
    }
  }
}

export const hardcoverCacheSync = new HardcoverCacheSync();
