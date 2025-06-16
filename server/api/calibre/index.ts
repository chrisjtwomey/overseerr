import CalibreWebDownloader from '@server/api/calibre/downloader';
import ExternalAPI from '@server/api/externalapi';
import type { AvailableCacheIds } from '@server/lib/cache';
import cacheManager from '@server/lib/cache';
import type { CalibreWebSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';

export interface CalibreWebBookOptions {
  isbn: string;
}

export interface CalibreWebBook {
  author_sort: string;
  authors: string;
  comments: string;
  cover: string;
  formats: string[];
  id: number;
  identifiers: Identifiers;
  isbn: string;
  languages: string[];
  last_modified: string;
  pubdate: string;
  publisher: string;
  rating: number;
  series: string;
  series_index: number;
  size: number;
  tags: any[];
  template: string;
  timestamp: string;
  title: string;
  uuid: string;
}

export interface Identifiers {
  isbn: string;
  'mobi-asin': string;
  'hardcover-edition': number;
  'hardcover-id': number;
  'hardcover-slug': string;
}

export interface CalibreWebGetBooksResponse {
  books: CalibreWebBook[];
  total: number;
}

export interface CalibreWebListBooksResponse {
  rows: CalibreWebBook[];
  total: number;
  totalNotFiltered: number;
}

export interface CalibreWebSendToEReaderResponse {
  type: 'success' | 'error' | 'danger';
  message: string;
}

export interface CalibreHealthResponse {
  calibre_rest_version: string;
  calibre_version: string;
}

class CalibreWebAPI extends ExternalAPI {
  static buildUrl(settings: CalibreWebSettings): string {
    return `${settings.useSsl ? 'https' : 'http'}://${settings.hostname}:${
      settings.port
    }${settings.urlBase ?? ''}`;
  }

  protected apiName: string;
  private downloader: CalibreWebDownloader;

  constructor({
    url,
    apiKey,
    cacheName,
    apiName,
  }: {
    url: string;
    apiKey: string;
    cacheName: AvailableCacheIds;
    apiName: string;
  }) {
    super(
      url,
      {},
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        nodeCache: cacheManager.getCache(cacheName).data,
      }
    );

    this.apiName = apiName;
    const settings = getSettings();
    this.downloader = new CalibreWebDownloader({
      url: CalibreWebDownloader.buildUrl(settings.calibreWebDownloader),
      cacheName: 'calibreWebDownloader',
      apiName: 'CalibreWebDownloader',
    });
  }

  public testAPIKey = async (apiKey: string): Promise<boolean> => {
    try {
      // TODO: change to a more appropriate endpoint when available
      const response = await this.axios.get('/me', {
        headers: {
          'X-API-KEY': apiKey,
        },
      });

      // Check if the response URL contains 'login' to determine if the API key is invalid
      if (response.request.res.responseUrl.includes('login')) {
        return false; // If the response URL contains 'login', the API key is invalid
      }

      return response.status === 200;
    } catch (e) {
      if (e.response && e.response.status === 401) {
        return false; // Unauthorized, API key is invalid
      }
      throw new Error(`[Calibre Web] Failed to test API key: ${e.message}`);
    }
  };

  public sendToEReader = async ({
    userAPIKey,
    bookId,
  }: {
    userAPIKey: string;
    bookId: number;
  }): Promise<void> => {
    try {
      const response = await this.axios.get<CalibreWebSendToEReaderResponse[]>(
        `/ajax/send/${bookId}/Epub`,
        {
          headers: {
            'X-API-KEY': userAPIKey,
          },
        }
      );

      if (response.status !== 200) {
        throw new Error(
          `[Calibre] Failed to send book to eReader: ${response.statusText}`
        );
      }

      for (const status of response.data) {
        if (status.type === 'error' || status.type === 'danger') {
          throw new Error(`[Calibre] ${status.message}`);
        }
      }
    } catch (e) {
      throw new Error(`[Calibre] Failed to send book to eReader: ${e.message}`);
    }
  };

  public getBooks = async ({
    offset = 0,
    limit = 50,
  }: {
    offset?: number;
    limit?: number;
  }): Promise<CalibreWebGetBooksResponse> => {
    try {
      const response = await this.axios.get<CalibreWebListBooksResponse>(
        '/ajax/listbooks',
        {
          params: {
            offset,
            limit,
          },
        }
      );

      return {
        books: response.data.rows,
        total: response.data.total,
      };
    } catch (e) {
      throw new Error(`[Calibre] Failed to retrieve books: ${e.message}`);
    }
  };

  public getRecentlyAdded = async ({
    addedAfter = Date.now() - 1000 * 60 * 60,
  }: {
    addedAfter?: number;
  }): Promise<CalibreWebGetBooksResponse> => {
    try {
      const response = await this.axios.get<CalibreWebListBooksResponse>(
        '/ajax/listbooks'
      );

      const books = response.data.rows.filter((book) => {
        const bookDate = new Date(book.timestamp).getTime();
        return bookDate >= addedAfter;
      });

      return {
        books,
        total: response.data.total,
      };
    } catch (e) {
      throw new Error(
        `[Calibre] Failed to retrieve recently added books: ${e.message}`
      );
    }
  };

  public getBookById = async (id: number): Promise<CalibreWebBook> => {
    const response = await this.axios.get<CalibreWebBook>(`/ajax/book/${id}`);
    if (response.status !== 200 || !response.data) {
      throw new Error(
        `[Calibre] Failed to retrieve book by ID: ${response.statusText}`
      );
    }

    return response.data;
  };

  public getBookByHardcoverId = async (
    id: number,
    options: { offset?: number; limit?: number } = {
      offset: 0,
      limit: 50,
    }
  ): Promise<CalibreWebBook> => {
    const response = await this.getBooks(options);
    const book = response.books.find(
      (book) => book.identifiers['hardcover-id'] === id
    );
    if (!book) {
      throw new Error('Book not found');
    }
    return book;
  };

  public getBookByIdentifier = async (
    identifier: string,
    options: { offset?: number; limit?: number } = {
      offset: 0,
      limit: 50,
    }
  ): Promise<CalibreWebBook> => {
    const response = await this.getBooks(options);
    const book = response.books.find(
      (book) =>
        book.isbn === identifier ||
        book.identifiers['isbn'] === identifier ||
        book.identifiers['mobi-asin'] === identifier
    );
    if (!book) {
      throw new Error('Book not found');
    }
    return book;
  };

  public addBook = async (
    identifier: string
  ): Promise<CalibreWebBook | undefined> => {
    try {
      const downloadCandidate =
        await this.downloader.searchBookDownloadCandidate({
          identifier,
          preferredFormat: 'azw3',
        });

      if (!downloadCandidate) {
        throw new Error('Book download candidate not found');
      }
      const response = await this.downloader.downloadBook(downloadCandidate.id);
      if (!response) {
        throw new Error('Failed to download book');
      }

      const status = await this.downloader.getStatus();
      if (status.error[downloadCandidate.id]) {
        throw new Error(
          `Failed to download book: Identifier: ${identifier}, ID: ${downloadCandidate.id}`
        );
      }

      if (
        status.available[downloadCandidate.id] ||
        status.done[downloadCandidate.id]
      ) {
        return this.getBookByIdentifier(identifier);
      }
    } catch (e) {
      throw new Error(`[Calibre] Failed to download book: ${e.message}`);
    }
  };
}

export default CalibreWebAPI;
