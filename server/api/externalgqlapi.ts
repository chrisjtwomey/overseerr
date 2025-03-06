import type {
  FetchPolicy,
  NormalizedCacheObject,
  OperationVariables,
  QueryOptions,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
} from '@apollo/client';
import { ApolloClient, createHttpLink, InMemoryCache } from '@apollo/client';
import { RetryLink } from '@apollo/client/link/retry';
import { persistCache } from 'apollo3-cache-persist';
import { AsyncNodeStorage } from 'redux-persist-node-storage';

export class GraphQLCache {
  public cache: InMemoryCache;

  constructor() {
    this.cache = new InMemoryCache();
  }

  init = async () => {
    await persistCache({
      cache: this.cache,
      storage: new AsyncNodeStorage('./config/cache'),
      maxSize: 5242880, // 5MB
    });
  };

  public get<T>(_key: string): T | undefined {
    throw new Error('Method not implemented.');
  }

  public getTtl(_key: string): number | undefined {
    throw new Error('Method not implemented.');
  }

  public set<T>(_key: string, _value: T, _ttl?: number): boolean {
    throw new Error('Method not implemented.');
  }

  public getStats() {
    const cacheObj = this.cache.extract();

    return {
      hits: 0,
      misses: 0,
      keys: Object.keys(cacheObj).length,
      ksize: 0,
      vsize: 0,
    };
  }

  public flushAll() {
    this.cache.reset();
  }
}

const globalCache = new GraphQLCache();
globalCache.init();

class ExternalGraphQLAPI {
  protected client: ApolloClient<NormalizedCacheObject>;
  protected cache: InMemoryCache;
  protected cachePolicy:
    | 'cache-first'
    | 'no-cache'
    | 'network-only'
    | 'cache-and-network' = 'cache-first';

  constructor(
    baseUrl: string,
    params: Record<string, unknown>,
    cachePolicy:
      | 'cache-first'
      | 'no-cache'
      | 'network-only'
      | 'cache-and-network' = 'cache-first'
  ) {
    this.client = new ApolloClient<NormalizedCacheObject>({
      cache: globalCache.cache,
      link: new RetryLink({
        delay: {
          initial: 1000,
          max: Infinity,
          jitter: true,
        },
        attempts: {
          max: 5,
          retryIf: (error) => !!error,
        },
      }).concat(
        createHttpLink({
          uri: baseUrl,
          headers: {
            Authorization: params.token as string,
          },
        })
      ),
      defaultOptions: {
        query: {
          fetchPolicy: cachePolicy as FetchPolicy,
          errorPolicy: 'all',
        },
        watchQuery: {
          fetchPolicy: cachePolicy as FetchPolicy,
          nextFetchPolicy: cachePolicy as WatchQueryFetchPolicy,
          errorPolicy: 'all',
        },
      },
      queryDeduplication: true,
      assumeImmutableResults: true,
    });
  }

  protected async get<
    TResult,
    TVariables extends OperationVariables | undefined
  >(
    query: TypedDocumentNode<TResult, TVariables>,
    variables: TVariables extends OperationVariables ? TVariables : undefined,
    queryOptions?: {
      fetchPolicy?: 'cache-first' | 'network-only' | 'no-cache';
    }
  ): Promise<TResult> {
    let options = {
      query: query,
      variables: variables,
    } as QueryOptions;

    if (queryOptions) {
      options = {
        ...options,
        ...queryOptions,
      };
    }

    const response = await this.client.query<TResult>(options);
    return response.data;
  }
}

export default ExternalGraphQLAPI;
