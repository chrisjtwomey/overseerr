import type { CalibreWebBook } from '@server/api/calibre';
import CalibreAPI from '@server/api/calibre';
import Hardcover from '@server/api/hardcover';
import type { HardcoverBook } from '@server/api/hardcover/interfaces';
import type {
  MediaIds,
  RunnableScanner,
  StatusBase,
} from '@server/lib/scanners/baseScanner';
import BaseScanner from '@server/lib/scanners/baseScanner';
import { getSettings } from '@server/lib/settings';
import { uniqWith } from 'lodash';

type SyncStatus = StatusBase;

class CalibreWebScanner
  extends BaseScanner<CalibreWebBook>
  implements RunnableScanner<SyncStatus>
{
  private isRecentOnly = false;

  public constructor(isRecentOnly = false) {
    super('Calibre Scan', { bundleSize: 50 });
    this.isRecentOnly = isRecentOnly;
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
      this.calibreClient = new CalibreAPI({
        url: CalibreAPI.buildUrl(settings.calibreWeb),
        apiKey: settings.calibreWeb.apiKey ?? '',
        cacheName: 'calibreWeb',
        apiName: 'calibreWeb',
      });

      if (this.isRecentOnly) {
        this.log(`Beginning to process recently added for library`, 'info', {
          lastScan: settings.calibreWeb.lastScan,
        });

        const booksResponse = await this.calibreClient.getRecentlyAdded({
          addedAfter: settings.calibreWeb.lastScan
            ? settings.calibreWeb.lastScan - 1000 * 60 * 10
            : undefined,
        });

        this.items = uniqWith(booksResponse.books, (a, b) => a.isbn === b.isbn);

        await this.loop(this.processCalibreBook.bind(this), { sessionId });

        settings.calibreWeb.lastScan = Date.now();
        settings.save();
      } else {
        this.log(`Beginning to process library`, 'info');
        await this.paginateLibrary({ sessionId });
      }
      this.log(
        this.isRecentOnly
          ? 'Recently Added Scan Complete'
          : 'Full Scan Complete',
        'info'
      );
    } catch (e) {
      this.log('Scan interrupted', 'error', {
        errorMessage: e.message,
      });
    } finally {
      this.endRun(sessionId);
    }
  }

  private async paginateLibrary({
    start = 0,
    sessionId,
  }: {
    start?: number;
    sessionId: string;
  }) {
    if (!this.running) {
      throw new Error('Sync was aborted.');
    }

    if (this.sessionId !== sessionId) {
      throw new Error('New session was started. Old session aborted.');
    }

    const response = await this.calibreClient.getBooks({
      limit: this.protectedBundleSize,
      offset: start,
    });

    this.progress = start;
    this.totalSize = response.total;

    if (response.total === 0 || response.books.length === 0) {
      return;
    }

    await Promise.all(
      response.books.map(async (book) => {
        await this.processCalibreBook(book);
      })
    );

    if (response.books.length < this.protectedBundleSize) {
      return;
    }

    await new Promise<void>((resolve, reject) =>
      setTimeout(() => {
        this.paginateLibrary({
          start: start + this.protectedBundleSize,
          sessionId,
        })
          .then(() => resolve())
          .catch((e) => reject(new Error(e.message)));
      }, this.protectedUpdateRate)
    );
  }

  private async processCalibreBook(book: CalibreWebBook) {
    let mediaIds: MediaIds | undefined;
    try {
      mediaIds = await this.getMediaIds(book);
    } catch (e) {
      this.log(`Unable to find media IDs for this book title`, 'debug', {
        title: book.title,
        identifiers: book.identifiers,
        error: e.message,
      });
      return;
    }

    if (mediaIds.hardcoverId) {
      await this.processBook(mediaIds.hardcoverId, {
        is4k: false,
        mediaAddedAt: new Date(book.timestamp),
        calibreBookId: book.id,
        title: book.title,
      });
    } else {
      const hardcover = new Hardcover(getSettings().hardcover);
      let hardcoverBook: HardcoverBook | undefined;

      if (mediaIds.isbn) {
        hardcoverBook = await hardcover.getBookByIdentifier({
          identifier: mediaIds.isbn,
        });
      } else if (mediaIds.asin) {
        hardcoverBook = await hardcover.getBookByIdentifier({
          identifier: mediaIds.asin,
        });
      }

      if (!hardcoverBook) {
        this.log(`Unable to find hardcover book`, 'debug', {
          title: book.title,
          identifiers: book.identifiers,
        });
        return;
      }

      await this.processBook(hardcoverBook.id, {
        is4k: false,
        mediaAddedAt: new Date(book.timestamp),
        calibreBookId: book.id,
        title: book.title,
      });
    }
  }

  private async getMediaIds(book: CalibreWebBook): Promise<MediaIds> {
    const mediaIds: Partial<MediaIds> = {};
    const { isbn, identifiers } = book;

    if (isbn) {
      mediaIds.isbn = isbn;
    }

    if (identifiers['isbn']) {
      mediaIds.isbn = identifiers['isbn'];
    }

    if (identifiers['hardcover-edition']) {
      mediaIds.hardcoverId = identifiers['hardcover-edition'];
    }

    if (identifiers['mobi-asin']) {
      mediaIds.asin = identifiers['mobi-asin'];
    }

    if (!mediaIds.hardcoverId && !mediaIds.isbn && !mediaIds.asin) {
      throw new Error('Unable to find Book Media IDs');
    }

    // We check above if we have any of the IDs, so we can safely assert the type below
    return mediaIds as MediaIds;
  }
}

export const calibreWebFullScanner = new CalibreWebScanner();
export const calibreWebRecentScanner = new CalibreWebScanner(true);
