import Hardcover from '@server/api/hardcover';
import type { HardcoverPaginatedResponse } from '@server/api/hardcover/interfaces';
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
  private MaxDiscoverPages = 10;
  private MaxTrendingPages = 2;
  private MaxUpcomingPages = 2;

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

  private async withPaging<T extends HardcoverPaginatedResponse>(
    operationName: string,
    pagedOperation: (page: number) => Promise<T>,
    maxPages = 10
  ) {
    let page = 1;

    while (page <= maxPages) {
      await pagedOperation(page)
        .then((response) => {
          this.log(`Fetched page ${page} of ${operationName}`, 'info', {
            page,
            pageResults: response.results.length,
            totalPages: response.total_pages,
            totalResults: response.total_results,
          });
          this.progress = response.page;
          this.totalSize = response.total_pages;
          this.running = true;

          page++;
        })
        .catch(async (error) => {
          this.log(`Error fetching page ${page} of ${operationName}`, 'error', {
            errorMessage: error.message,
          });
          return Promise.reject(error);
        });
    }
  }

  public async run(): Promise<void> {
    const settings = getSettings();
    const sessionId = this.startRun();
    try {
      this.hardcover = new Hardcover({
        token: settings.hardcover.token,
        cachePolicy: 'network-only',
      });
      const now = new Date();
      const offset = now.getTimezoneOffset();

      this.log(`Beginning to refresh Hardcover metadata cache`, 'info');

      await this.withPaging<HardcoverPaginatedResponse>(
        'Discover Books',
        async (page: number) => {
          return this.hardcover.getDiscoverBooks({
            releaseDateGte: Hardcover.DefaultPastDate,
            releaseDateLte: new Date().toISOString().split('T')[0],
            page,
          });
        },
        this.MaxDiscoverPages
      );

      await this.withPaging<HardcoverPaginatedResponse>(
        'Trending Books',
        async (page: number) => {
          return this.hardcover.getTrendingBooks({
            page,
          });
        },
        this.MaxTrendingPages
      );

      await this.withPaging<HardcoverPaginatedResponse>(
        'Upcoming Books',
        async (page: number) => {
          return this.hardcover.getDiscoverBooks({
            page,
            releaseDateGte: new Date(now.getTime() - offset * 60 * 1000)
              .toISOString()
              .split('T')[0],
          });
        },
        this.MaxUpcomingPages
      );

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
