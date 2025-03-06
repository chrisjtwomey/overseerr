import { GraphQLCache } from '@server/api/externalgqlapi';
import NodeCache from 'node-cache';

export type AvailableCacheIds =
  | 'tmdb'
  | 'radarr'
  | 'sonarr'
  | 'calibreWeb'
  | 'calibreWebDownloader'
  | 'rt'
  | 'imdb'
  | 'github'
  | 'plexguid'
  | 'plextv'
  | 'plexwatchlist'
  | 'hardcover';

const DEFAULT_TTL = 300;
const DEFAULT_CHECK_PERIOD = 120;

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  ksize: number;
  vsize: number;
}

export interface CacheStore {
  get<T>(key: string): T | undefined;
  getTtl(key: string): number | undefined;
  set<T>(key: string, value: T, ttl?: number): boolean;

  getStats(): CacheStats;
  flushAll(): void;
}

class Cache {
  public id: AvailableCacheIds;
  public data: CacheStore;
  public name: string;

  constructor(id: AvailableCacheIds, name: string, cacheStore: CacheStore) {
    this.id = id;
    this.name = name;
    this.data = cacheStore;
  }

  public getStats() {
    return this.data.getStats();
  }

  public flush(): void {
    this.data.flushAll();
  }
}

class CacheManager {
  private availableCaches: Record<AvailableCacheIds, Cache> = {
    tmdb: new Cache(
      'tmdb',
      'The Movie Database API',
      new NodeCache({
        stdTTL: 21600,
        checkperiod: 60 * 30,
      })
    ),
    radarr: new Cache(
      'radarr',
      'Radarr API',
      new NodeCache({
        stdTTL: DEFAULT_TTL,
        checkperiod: DEFAULT_CHECK_PERIOD,
      })
    ),
    sonarr: new Cache(
      'sonarr',
      'Sonarr API',
      new NodeCache({
        stdTTL: DEFAULT_TTL,
        checkperiod: DEFAULT_CHECK_PERIOD,
      })
    ),
    calibreWeb: new Cache(
      'calibreWeb',
      'Calibre Web API',
      new NodeCache({
        stdTTL: DEFAULT_TTL,
        checkperiod: DEFAULT_CHECK_PERIOD,
      })
    ),
    calibreWebDownloader: new Cache(
      'calibreWebDownloader',
      'Calibre Web Downloader API',
      new NodeCache({
        stdTTL: DEFAULT_TTL,
        checkperiod: DEFAULT_CHECK_PERIOD,
      })
    ),
    rt: new Cache(
      'rt',
      'Rotten Tomatoes API',
      new NodeCache({
        stdTTL: 43200,
        checkperiod: 60 * 30,
      })
    ),
    imdb: new Cache(
      'imdb',
      'IMDB Radarr Proxy',
      new NodeCache({
        stdTTL: 43200,
        checkperiod: 60 * 30,
      })
    ),
    github: new Cache(
      'github',
      'GitHub API',
      new NodeCache({
        stdTTL: 21600,
        checkperiod: 60 * 30,
      })
    ),
    plexguid: new Cache(
      'plexguid',
      'Plex GUID',
      new NodeCache({
        stdTTL: 86400 * 7, // 1 week cache
        checkperiod: 60 * 30,
      })
    ),
    plextv: new Cache(
      'plextv',
      'Plex TV',
      new NodeCache({
        stdTTL: 86400 * 7, // 1 week cache
        checkperiod: 60 * 30,
      })
    ),
    plexwatchlist: new Cache(
      'plexwatchlist',
      'Plex Watchlist',
      new NodeCache({
        stdTTL: DEFAULT_TTL,
        checkperiod: DEFAULT_CHECK_PERIOD,
      })
    ),
    hardcover: new Cache('hardcover', 'Hardcover', new GraphQLCache()),
  };

  public getCache(id: AvailableCacheIds): Cache {
    return this.availableCaches[id];
  }

  public getAllCaches(): Record<string, Cache> {
    return this.availableCaches;
  }
}

const cacheManager = new CacheManager();

export default cacheManager;
