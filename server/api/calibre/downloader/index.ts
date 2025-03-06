import ExternalAPI from '@server/api/externalapi';
import type { AvailableCacheIds } from '@server/lib/cache';
import cacheManager from '@server/lib/cache';
import type { CalibreWebDownloaderSettings } from '@server/lib/settings';

export interface StatusBookItem {
  author: string;
  download_urls: string[];
  format: string;
  id: string;
  info: BookInfo;
  language: string;
  preview: string;
  publisher: string;
  size: string;
  title: string;
  year: string;
}

export interface BookInfo {
  'Alternative author': string[];
  'Alternative description': string[];
  'Alternative edition': string[];
  'Alternative publisher': string[];
  Goodreads: string[];
  'Goodreads Source Scrape Date': string[];
  'ISBN-10': string[];
  'ISBN-13': string[];
  Language: string[];
  Year: string[];
}

export interface Status {
  available: {
    [id: string]: StatusBookItem;
  };
  done: {
    [id: string]: StatusBookItem;
  };
  downloading: {
    [id: string]: StatusBookItem;
  };
  queued: {
    [id: string]: StatusBookItem;
  };
  error: {
    [id: string]: StatusBookItem;
  };
}

export interface SearchBookOptions {
  identifier: string;
  preferredFormat?: 'epub' | 'mobi' | 'azw3';
}

export interface DownloadBookResponse {
  status: string;
}

export interface SearchBookDownloadCandidate {
  id: string;
  author: string;
  download_urls: string[];
  format: 'epub' | 'mobi' | 'azw3';
  language: string;
  preview: string;
  publisher: string;
  size: string;
  title: string;
  year: string;
}

export type SearchBookResults = SearchBookDownloadCandidate[];

class CalibreWebDownloader extends ExternalAPI {
  static buildUrl(settings: CalibreWebDownloaderSettings): string {
    return `${settings.useSsl ? 'https' : 'http'}://${settings.hostname}:${
      settings.port
    }${settings.urlBase ?? ''}`;
  }

  protected apiName: string;

  constructor({
    url,
    cacheName,
    apiName,
  }: {
    url: string;
    cacheName: AvailableCacheIds;
    apiName: string;
  }) {
    super(
      url,
      {},
      {
        nodeCache: cacheManager.getCache(cacheName).data,
      }
    );

    this.apiName = apiName;
  }

  public async searchBookDownloadCandidate(
    options: SearchBookOptions
  ): Promise<SearchBookDownloadCandidate> {
    try {
      const response = await this.axios.get<SearchBookResults>(
        `/request/api/search`,
        {
          params: {
            isbn: options.identifier,
          },
        }
      );

      if (!response.data || response.data.length === 0) {
        throw new Error('No books found');
      }

      const preferredBooks = response.data.filter((book) => {
        return book.format === options.preferredFormat;
      });
      if (preferredBooks.length > 0) {
        return preferredBooks[0];
      }

      return response.data[0];
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to retrieve book: ${e.message}`
      );
    }
  }

  public async downloadBook(bookID: string): Promise<boolean> {
    try {
      const response = await this.axios.get<DownloadBookResponse>(
        `/request/api/download`,
        {
          params: {
            id: bookID,
          },
        }
      );

      if (!response.data || response.data.status !== 'queued') {
        throw new Error('Failed to download book');
      }

      return true;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to download book: ${e.message}`
      );
    }
  }

  public async getStatus(): Promise<Status> {
    try {
      const response = await this.axios.get<Status>(`/request/api/status`);

      if (!response.data) {
        throw new Error('Failed to retrieve status');
      }

      return response.data;
    } catch (e) {
      throw new Error(
        `[${this.apiName}] Failed to retrieve status: ${e.message}`
      );
    }
  }
}

export default CalibreWebDownloader;
