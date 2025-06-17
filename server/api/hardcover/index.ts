import ExternalGraphQLAPI from '@server/api/externalgqlapi';
import type {
  AuthorFragment,
  BookFragment,
  EditionFragment,
  GetAuthorByIdQuery,
  GetAuthorByIdQueryVariables,
  GetAuthorByIdsQuery,
  GetAuthorByIdsQueryVariables,
  GetBookByEditionIdQuery,
  GetBookByEditionIdQueryVariables,
  GetBookByIdentifierQuery,
  GetBookByIdentifierQueryVariables,
  GetBookByIdQuery,
  GetBookByIdQueryVariables,
  GetBookRecommendationsQuery,
  GetBookRecommendationsQueryVariables,
  GetBooksByAuthorIdQuery,
  GetBooksByAuthorIdQueryVariables,
  GetBooksByIDsQuery,
  GetBooksByIDsQueryVariables,
  GetBooksBySeriesIdQuery,
  GetBooksBySeriesIdQueryVariables,
  GetBooksQuery,
  GetBooksQueryVariables,
  GetEditionsByBookIdQuery,
  GetEditionsByBookIdQueryVariables,
  GetMeQuery,
  GetMeQueryVariables,
  GetTagsByCategoryQuery,
  GetTagsByCategoryQueryVariables,
  GetTrendingBookIDsQuery,
  GetTrendingBookIDsQueryVariables,
  LanguageFragment,
  Order_By,
  PublisherFragment,
  SearchQuery,
  SearchQueryVariables,
  TagFragment,
} from '@server/api/hardcover/graphql/graphql';
import {
  GetAuthorByIdDocument,
  GetAuthorByIdsDocument,
  GetBookByEditionIdDocument,
  GetBookByIdDocument,
  GetBookByIdentifierDocument,
  GetBookRecommendationsDocument,
  GetBooksByAuthorIdDocument,
  GetBooksByIDsDocument,
  GetBooksBySeriesIdDocument,
  GetBooksDocument,
  GetEditionsByBookIdDocument,
  GetMeDocument,
  GetTagsByCategoryDocument,
  GetTrendingBookIDsDocument,
  SearchDocument,
} from '@server/api/hardcover/graphql/graphql';
import type {
  HardcoverAuthor,
  HardcoverBook,
  HardcoverEdition,
  HardcoverLanguage,
  HardcoverPaginatedResponse,
  HardcoverPublisher,
  HardcoverTag,
} from './interfaces';

export type SortOptions =
  | 'popularity.asc'
  | 'popularity.desc'
  | 'release_date.asc'
  | 'release_date.desc'
  | 'title.asc'
  | 'title.desc'
  | 'vote_average.asc'
  | 'vote_average.desc'
  | 'vote_count.asc'
  | 'vote_count.desc';

interface DiscoverBookOptions {
  page?: number;
  includeAdult?: boolean;
  language?: string;
  releaseDateGte?: string;
  releaseDateLte?: string;
  voteAverageGte?: string;
  voteAverageLte?: string;
  voteCountGte?: string;
  voteCountLte?: string;
  originalLanguage?: string;
  genre?: string;
  author?: number;
  keywords?: string;
  sortBy?: SortOptions;
}

class Hardcover extends ExternalGraphQLAPI {
  private region?: string;
  private originalLanguage?: string;
  public static readonly DefaultPastDate = '2000-01-01';
  public static readonly PageSize = 20;

  constructor({
    token,
    region,
    originalLanguage,
    cachePolicy = 'cache-first',
  }: {
    token?: string;
    region?: string;
    originalLanguage?: string;
    cachePolicy?:
      | 'cache-first'
      | 'no-cache'
      | 'network-only'
      | 'cache-and-network';
  }) {
    super('https://api.hardcover.app/v1/graphql', { token }, cachePolicy);
    this.region = region;
    this.originalLanguage = originalLanguage;
  }

  public testConnection = async (): Promise<void> => {
    try {
      await this.get<GetMeQuery, GetMeQueryVariables>(
        GetMeDocument,
        {},
        {
          fetchPolicy: 'no-cache',
        }
      );
    } catch (e) {
      throw new Error(`[Hardcover] Hardcover connection failed: ${e.message}`);
    }
  };

  public getBookByID = async ({
    bookId,
    language = 'en',
  }: {
    bookId: number;
    language?: string;
  }): Promise<HardcoverBook> => {
    try {
      const booksData = await this.get<
        GetBookByIdQuery,
        GetBookByIdQueryVariables
      >(GetBookByIdDocument, {
        bookId,
        language,
      });

      const bookData = booksData.books_by_pk as BookFragment;
      const book = await this.mapBookFragment(bookData, language);

      return book;
    } catch (e) {
      throw new Error(
        `[Hardcover] Failed to fetch book ID ${bookId}: ${e.message}`
      );
    }
  };

  public getBookByEditionID = async ({
    editionId,
    language = 'en',
  }: {
    editionId: number;
    language?: string;
  }): Promise<HardcoverBook> => {
    try {
      const bookData = await this.get<
        GetBookByEditionIdQuery,
        GetBookByEditionIdQueryVariables
      >(GetBookByEditionIdDocument, {
        editionId,
        language,
      });

      if (bookData.editions_by_pk?.book === null) {
        throw new Error(
          `[Hardcover] Book with edition ID ${editionId} not found`
        );
      }

      const bookFragment = bookData.editions_by_pk?.book as BookFragment;
      const book = await this.mapBookFragment(bookFragment, language);

      return book;
    } catch (e) {
      throw new Error(
        `[Hardcover] Failed to fetch book with edition ID ${editionId}: ${e.message}`
      );
    }
  };

  public getBookByIdentifier = async ({
    identifier,
    language = 'en',
  }: {
    identifier: string;
    language?: string;
  }): Promise<HardcoverBook> => {
    try {
      const booksData = await this.get<
        GetBookByIdentifierQuery,
        GetBookByIdentifierQueryVariables
      >(GetBookByIdentifierDocument, {
        identifier,
      });

      if (booksData.books.length === 0) {
        throw new Error(
          `[Hardcover] Book with identifier ${identifier} not found`
        );
      }
      const bookData = booksData.books[0] as BookFragment;
      const book = await this.mapBookFragment(bookData, language);

      return book;
    } catch (e) {
      throw new Error(
        `[Hardcover] Failed to fetch book with identifier ${identifier}: ${e.message}`
      );
    }
  };

  public getBooksBySeriesID = async ({
    seriesId,
    language = 'en',
    page = 1,
  }: {
    seriesId: number;
    language?: string;
    page: number;
  }): Promise<HardcoverPaginatedResponse> => {
    const limit = Hardcover.PageSize;
    const offset = (page - 1) * limit;

    try {
      const seriesData = await this.get<
        GetBooksBySeriesIdQuery,
        GetBooksBySeriesIdQueryVariables
      >(GetBooksBySeriesIdDocument, {
        seriesId,
        offset,
        limit,
      });

      if (seriesData.series_by_pk === null) {
        return {
          results: [],
          page: page,
          total_results: 0,
          total_pages: 0,
        };
      }

      const books = await Promise.all(
        (seriesData.series_by_pk?.book_series ?? []).map(
          async (bookData) =>
            await this.mapBookFragment(bookData.book as BookFragment, language)
        )
      );

      return {
        results: books,
        page: page,
        total_results: books.length,
        total_pages: 1,
      };
    } catch (e) {
      throw new Error(
        `[Hardcover] Failed to fetch books for series ID ${seriesId}: ${e.message}`
      );
    }
  };

  public getBooksSimilar = async ({
    bookId,
    language = 'en',
    page = 1,
  }: {
    bookId: number;
    language?: string;
    page: number;
  }): Promise<HardcoverPaginatedResponse> => {
    const limit = Hardcover.PageSize;
    const offset = (page - 1) * limit;
    const total_pages = 10;
    const total_results = limit * total_pages;

    try {
      const booksData = await this.get<
        GetBookRecommendationsQuery,
        GetBookRecommendationsQueryVariables
      >(GetBookRecommendationsDocument, {
        bookId,
        limit,
        offset,
      });

      const books = await Promise.all(
        booksData.recommendations.map(
          async (bookData) =>
            await this.mapBookFragment(
              bookData.item_book as BookFragment,
              language
            )
        )
      );

      return {
        results: books,
        page: page,
        total_results: total_results,
        total_pages: total_pages,
      };
    } catch (e) {
      throw new Error(
        `[Hardcover] Failed to fetch similar books for ID ${bookId}: ${e.message}`
      );
    }
  };

  getTrendingBooks = async ({
    from = new Date(
      new Date().getFullYear(),
      new Date().getMonth() - 3, // in the last 3 months
      new Date().getDate(),
      0,
      0,
      0,
      0
    ).toISOString(),
    to = new Date().toISOString(),
    language = 'en',
    page = 1,
  }: {
    from?: string;
    to?: string;
    language?: string;
    page?: number;
  }): Promise<HardcoverPaginatedResponse> => {
    const limit = Hardcover.PageSize;
    const offset = (page - 1) * limit;
    const total_pages = 3;
    const total_results = limit * total_pages;

    try {
      const trendingBookIDsData = await this.get<
        GetTrendingBookIDsQuery,
        GetTrendingBookIDsQueryVariables
      >(GetTrendingBookIDsDocument, {
        from,
        to,
        limit,
        offset,
      });

      const trendingBookIDs = (trendingBookIDsData.books_trending?.ids || [])
        .filter((id: number | null): id is number => id !== null)
        .map(Number);
      const getBooksByIDsQueryVariables = {
        bookIds: trendingBookIDs,
        language,
      };

      const trendingBooksData = await this.get<
        GetBooksByIDsQuery,
        GetBooksByIDsQueryVariables
      >(GetBooksByIDsDocument, getBooksByIDsQueryVariables);

      const books = await (
        await Promise.all(
          trendingBooksData.books.map(
            async (bookData) =>
              await this.mapBookFragment(bookData as BookFragment, language)
          )
        )
      ).sort(
        // sort books by the IDs of the trendingBooksData - ideal if I could do this in the GraphQL query
        (a, b) => trendingBookIDs.indexOf(a.id) - trendingBookIDs.indexOf(b.id)
      );

      return {
        results: books,
        page: page,
        total_results: total_results,
        total_pages: total_pages,
      };
    } catch (e) {
      throw new Error(
        `[Hardcover] Failed to fetch trending Books: ${e.message}`
      );
    }
  };

  public searchBooks = async ({
    searchTerm,
    language = 'en',
    page = 1,
  }: {
    searchTerm: string;
    language?: string;
    page: number;
  }): Promise<HardcoverPaginatedResponse> => {
    const limit = Hardcover.PageSize;
    try {
      const searchData = await this.get<SearchQuery, SearchQueryVariables>(
        SearchDocument,
        {
          query: searchTerm,
          query_type: 'book',
          per_page: limit,
          page: page,
        }
      );

      if (searchData.search?.results.found == 0) {
        return {
          results: [],
          page: page,
          total_results: 0,
          total_pages: 0,
        };
      }

      const bookIds = searchData.search?.results['hits'].map(
        (hit: {
          document: {
            id: number;
          };
        }) => hit.document.id
      ) as number[];
      const booksData = await this.get<
        GetBooksByIDsQuery,
        GetBooksByIDsQueryVariables
      >(GetBooksByIDsDocument, {
        bookIds,
        orderBy: {
          users_count: 'desc' as Order_By,
          rating: 'desc' as Order_By,
        },
      });

      const books = await Promise.all(
        booksData.books.map(
          async (bookData) =>
            await this.mapBookFragment(bookData as BookFragment, language)
        )
      );

      return {
        results: books,
        page: page,
        total_results: searchData.search?.results.found || 0,
        total_pages: Math.ceil(searchData.search?.results.found / limit),
      };
    } catch (e) {
      throw new Error(
        `[Hardcover] Failed to search books using query '${searchTerm}': ${e.message}`
      );
    }
  };

  public searchAuthors = async ({
    searchTerm,
    page = 1,
  }: {
    searchTerm: string;
    page: number;
  }): Promise<HardcoverPaginatedResponse> => {
    const limit = Hardcover.PageSize;
    try {
      const searchData = await this.get<SearchQuery, SearchQueryVariables>(
        SearchDocument,
        {
          query: searchTerm,
          query_type: 'author',
          per_page: limit,
          page: page,
        }
      );

      if (searchData.search?.results.found == 0) {
        return {
          results: [],
          page: page,
          total_results: 0,
          total_pages: 0,
        };
      }

      const authorIds = searchData.search?.results['hits'].map(
        (hit: {
          document: {
            id: number;
          };
        }) => hit.document.id
      ) as number[];

      const authorsData = await this.get<
        GetAuthorByIdsQuery,
        GetAuthorByIdsQueryVariables
      >(GetAuthorByIdsDocument, {
        authorIds,
      });

      const authors = authorsData.authors.map(
        (authorData) =>
          this.mapAuthorFragment(
            authorData as AuthorFragment
          ) as HardcoverAuthor
      );

      return {
        results: authors,
        page: page,
        total_results: searchData.search?.results.found || 0,
        total_pages: Math.ceil(searchData.search?.results.found / limit),
      };
    } catch (e) {
      throw new Error(
        `[Hardcover] Failed to search authors using query '${searchTerm}': ${e.message}`
      );
    }
  };

  public searchMulti = async ({
    searchTerm,
    language = 'en',
    page = 1,
  }: {
    searchTerm: string;
    language?: string;
    page: number;
  }): Promise<HardcoverPaginatedResponse> => {
    try {
      const booksData = await this.searchBooks({
        searchTerm,
        language,
        page,
      });

      const authorsData = await this.searchAuthors({
        searchTerm,
        page,
      });

      return {
        results: [...booksData.results, ...authorsData.results],
        page: page,
        total_results: booksData.total_results + authorsData.total_results,
        total_pages: Math.ceil(
          (booksData.total_results + authorsData.total_results) / 25
        ),
      };
    } catch (e) {
      throw new Error(
        `[Hardcover] Failed to search multi using query ${searchTerm}: ${e.message}`
      );
    }
  };

  public getAuthor = async ({
    authorId,
  }: {
    authorId: number;
  }): Promise<HardcoverAuthor> => {
    try {
      const authorData = await this.get<
        GetAuthorByIdQuery,
        GetAuthorByIdQueryVariables
      >(GetAuthorByIdDocument, {
        authorId,
      });

      if (authorData.authors_by_pk === null) {
        throw new Error(`[Hardcover] Author ID ${authorId} not found`);
      }

      const author = authorData.authors_by_pk as AuthorFragment;
      return this.mapAuthorFragment(author);
    } catch (e) {
      throw new Error(
        `[Hardcover] Failed to fetch author ID ${authorId}: ${e.message}`
      );
    }
  };

  public getAuthorBooks = async ({
    authorId,
    language = 'en',
    page = 1,
  }: {
    authorId: number;
    language?: string;
    page?: number;
  }): Promise<HardcoverPaginatedResponse> => {
    if (page === undefined || isNaN(page)) {
      page = 1;
    }

    const limit = Hardcover.PageSize;
    const offset = (page - 1) * limit;

    try {
      const booksData = await this.get<
        GetBooksByAuthorIdQuery,
        GetBooksByAuthorIdQueryVariables
      >(GetBooksByAuthorIdDocument, {
        authorId,
        limit,
        offset,
      });

      const books = await Promise.all(
        booksData.books.map(
          async (bookData) =>
            await this.mapBookFragment(bookData as BookFragment, language)
        )
      );

      return {
        results: books,
        page: page,
        total_results: booksData.books_aggregate.aggregate?.count || 0,
        total_pages: booksData.books_aggregate.aggregate
          ? Math.ceil(booksData.books_aggregate.aggregate.count / limit)
          : 0,
      };
    } catch (e) {
      throw new Error(
        `[Hardcover] Failed to fetch books by author ID ${authorId}: ${e.message}`
      );
    }
  };

  public getDiscoverBooks = async ({
    sortBy = 'popularity.desc',
    page = 1,
    language = 'en',
    releaseDateGte,
    releaseDateLte,
    originalLanguage,
    genre,
    author,
    keywords,
    voteAverageGte,
    voteAverageLte,
    voteCountGte,
    voteCountLte,
  }: DiscoverBookOptions = {}): Promise<HardcoverPaginatedResponse> => {
    const defaultFutureDate = new Date().toISOString().split('T')[0];
    const defaultPastDate = new Date(Hardcover.DefaultPastDate)
      .toISOString()
      .split('T')[0];

    const limit = Hardcover.PageSize;
    const offset = (page - 1) * limit;

    try {
      let orderBy: { [key: string]: Order_By } = {};
      switch (sortBy) {
        case 'popularity.desc':
          orderBy = {
            users_count: 'desc' as Order_By,
            // rating: 'desc' as Order_By,
          };
          break;
        case 'popularity.asc':
          orderBy = {
            users_count: 'asc' as Order_By,
            // rating: 'asc' as Order_By,
          };
          break;
        case 'release_date.desc':
          orderBy = { release_date: 'desc' as Order_By };
          break;
        case 'release_date.asc':
          orderBy = { release_date: 'asc' as Order_By };
          break;
        case 'title.asc':
          orderBy = { title: 'asc' as Order_By };
          break;
        case 'title.desc':
          orderBy = { title: 'desc' as Order_By };
          break;
        case 'vote_average.desc':
          orderBy = { rating: 'desc' as Order_By };
          break;
        case 'vote_average.asc':
          orderBy = { rating: 'asc' as Order_By };
          break;
      }

      const getBooksQueryVariables: GetBooksQueryVariables = {
        where: {
          release_date: {
            _gte: !releaseDateGte ? defaultPastDate : releaseDateGte,
            _lte: !releaseDateLte ? defaultFutureDate : releaseDateLte,
          },
        },
        limit,
        offset,
        orderBy,
      };

      if (originalLanguage !== undefined) {
        getBooksQueryVariables.where = {
          ...getBooksQueryVariables.where,
          default_physical_edition: {
            language: {
              code2: {
                _eq: originalLanguage,
              },
            },
          },
        };
      }
      if (author !== undefined) {
        getBooksQueryVariables.where = {
          ...getBooksQueryVariables.where,
          contributions: {
            author_id: {
              _eq: author,
            },
          },
        };
      }
      if (voteAverageGte !== undefined) {
        getBooksQueryVariables.where = {
          ...getBooksQueryVariables.where,
          rating: {
            _gte: voteAverageGte,
          },
        };
      }
      if (voteAverageLte !== undefined) {
        getBooksQueryVariables.where = {
          ...getBooksQueryVariables.where,
          rating: {
            _lte: voteAverageLte,
          },
        };
      }
      if (voteCountGte !== undefined) {
        getBooksQueryVariables.where = {
          ...getBooksQueryVariables.where,
          ratings_count: {
            _gte: Number(voteCountGte),
          },
        };
      }
      if (voteCountLte !== undefined) {
        getBooksQueryVariables.where = {
          ...getBooksQueryVariables.where,
          ratings_count: {
            _lte: Number(voteCountLte),
          },
        };
      }
      if (genre !== undefined) {
        // ensure genres is an array
        const genreIds = genre.split(',').map((id) => parseInt(id, 10));
        getBooksQueryVariables.where = {
          ...getBooksQueryVariables.where,
          taggings: {
            tag: {
              id: {
                _in: genreIds,
              },
            },
          },
        };
      }
      if (keywords !== undefined) {
        const keywordIds = keywords.split(',').map((id) => parseInt(id, 10));
        getBooksQueryVariables.where = {
          ...getBooksQueryVariables.where,
          taggings: {
            id: {
              _in: keywordIds,
            },
          },
        };
      }

      getBooksQueryVariables.where = {
        ...getBooksQueryVariables.where,
        editions_count: { _gt: 0 },
      };

      const booksData = await this.get<GetBooksQuery, GetBooksQueryVariables>(
        GetBooksDocument,
        getBooksQueryVariables
      );

      const books = await Promise.all(
        booksData.books.map(
          async (bookData) =>
            await this.mapBookFragment(bookData as BookFragment, language)
        )
      );

      return {
        results: books,
        page: page,
        total_results: booksData.books_aggregate.aggregate?.count || 0,
        total_pages: booksData.books_aggregate.aggregate
          ? Math.ceil(booksData.books_aggregate.aggregate.count / limit)
          : 0,
      };
    } catch (e) {
      throw new Error(
        `[Hardcover] Failed to fetch discover Books: ${e.message}`
      );
    }
  };

  public getGenres = async (): Promise<HardcoverTag[]> => {
    try {
      const tagsData = await this.get<
        GetTagsByCategoryQuery,
        GetTagsByCategoryQueryVariables
      >(GetTagsByCategoryDocument, {
        categorySlug: 'genre',
        limit: 100,
        offset: 0,
      });

      const genres = tagsData.tags.map(
        (tag) => this.mapTagFragment(tag as TagFragment) as HardcoverTag
      );

      return genres;
    } catch (e) {
      throw new Error(`[Hardcover] Failed to fetch genres: ${e.message}`);
    }
  };

  private mapBookFragment = async (
    bookData: BookFragment,
    language: string
  ): Promise<HardcoverBook> => {
    const defaultEdition = bookData.default_physical_edition
      ? this.mapEditionFragment(
          bookData.default_physical_edition as EditionFragment
        )
      : bookData.default_ebook_edition
      ? this.mapEditionFragment(
          bookData.default_ebook_edition as EditionFragment
        )
      : undefined;

    let selectedEdition: HardcoverEdition | undefined;

    const editionsData = await this.get<
      GetEditionsByBookIdQuery,
      GetEditionsByBookIdQueryVariables
    >(GetEditionsByBookIdDocument, {
      bookId: bookData.id,
      language: language || 'en',
      limit: 3,
    });

    if (editionsData.editions.length > 0) {
      selectedEdition = editionsData.editions.map((editionData) =>
        this.mapEditionFragment(editionData as EditionFragment)
      )[0];
    }

    if (!selectedEdition) {
      if (!defaultEdition) {
        throw new Error(
          `[Hardcover] No editions found for book ID ${bookData.id}`
        );
      }
      selectedEdition = defaultEdition;
    }

    const book = {
      media_type: 'book' as const,
      id: selectedEdition.id,
      bookId: bookData.id,
      identifiers: [],
      title: selectedEdition.title,
      original_title: bookData.title || defaultEdition?.title,
      release_date: selectedEdition.release_date || '',
      original_release_date:
        bookData.release_date || defaultEdition?.release_date,
      publisher: selectedEdition.publisher,
      original_publisher: defaultEdition?.publisher,
      language: selectedEdition.language,
      original_language: defaultEdition?.language,
      headline: bookData.headline || '',
      description: selectedEdition.description || '',
      pages: selectedEdition.pages || 0,
      series: bookData.cached_featured_series
        ? {
            id: bookData.cached_featured_series?.series?.id || 0,
            name:
              bookData.cached_featured_series?.series?.name || 'Unknown Series',
            position: bookData.cached_featured_series?.position || 0,
            books_count:
              bookData.cached_featured_series?.series?.books_count || 0,
          }
        : undefined,
      image_url: bookData.cached_image?.url || '',
      rating: bookData.rating || 0.0,
      ratings_count: bookData.ratings_count || 0,
      authors:
        bookData.cached_contributors?.map(
          (contributor: { author: AuthorFragment }) =>
            this.mapAuthorFragment(contributor.author)
        ) || [],
      genres:
        bookData.cached_tags?.Genre?.map((tag: TagFragment) =>
          this.mapTagFragment(tag)
        ) || [],
      moods:
        bookData.cached_tags?.Mood?.map((tag: TagFragment) =>
          this.mapTagFragment(tag)
        ) || [],
      external_ids: {
        isbn: selectedEdition.ISBN,
        asin: selectedEdition.ASIN,
        hardcover_id: bookData.id,
      },
      external_urls: {
        hardcover: `https://hardcover.app/books/${bookData.slug}`,
        goodreads: selectedEdition?.external_urls?.goodreads,
        open_library: selectedEdition?.external_urls?.openlibrary,
        amazon: selectedEdition?.external_urls?.amazon,
        isbndb: selectedEdition.external_urls?.isbndb,
      },
      status: bookData.release_date
        ? new Date(bookData.release_date) < new Date()
          ? 'Published'
          : 'Not released'
        : ('Unknown' as 'Published' | 'Not released' | 'Unknown'),
      // series_ids: bookData.book_series.map((series) => series.id),
    } as HardcoverBook;

    for (const edition of editionsData.editions) {
      if (edition.isbn_13) {
        book.identifiers.push(edition.isbn_13);
      }

      if (edition.isbn_10) {
        book.identifiers.push(edition.isbn_10);
      }

      if (edition.asin) {
        book.identifiers.push(edition.asin);
      }
    }
    // ensure identifiers contains unique values
    book.identifiers = Array.from(new Set(book.identifiers));

    return book;
  };

  private mapPublisherFragment = (
    publisherData: PublisherFragment
  ): HardcoverPublisher => ({
    id: publisherData.id,
    name: publisherData.name || 'Unknown Publisher',
  });

  private mapLanuageFragment = (
    languageData: LanguageFragment
  ): HardcoverLanguage => ({
    name: languageData.language,
    code: languageData.code2 || 'en',
  });

  private mapTagFragment = (tagData: TagFragment): HardcoverTag => ({
    id: tagData.id,
    name: tagData.tag
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '),
    type: tagData.tag_category?.slug === 'genre' ? 'genre' : 'mood',
    backdrops: [],
  });

  private mapEditionFragment = (
    editionData: EditionFragment
  ): HardcoverEdition => {
    const edition = {
      id: editionData.id,
      ISBN: editionData?.isbn_13 || editionData?.isbn_10 || undefined,
      ASIN: editionData?.asin || undefined,
      title: editionData?.title || 'Unknown Title',
      description: editionData?.description || '',
      pages: editionData?.pages || 0,
      publisher:
        editionData.publisher !== null
          ? this.mapPublisherFragment(
              editionData.publisher as PublisherFragment
            )
          : undefined,
      language:
        editionData.language !== null
          ? this.mapLanuageFragment(editionData.language as LanguageFragment)
          : undefined,
      release_date: editionData.release_date || '',
      external_urls: {},
    } as HardcoverEdition;

    if (edition.ASIN) {
      edition.external_urls.amazon = `https://www.amazon.com/dp/${edition.ASIN}`;
    }

    if (edition.ISBN) {
      edition.external_urls.isbndb = `https://isbndb.com/book/${edition.ISBN}`;
    }

    if (editionData.identifiers?.goodreads.length > 0) {
      edition.external_urls.goodreads = `https://www.goodreads.com/book/show/${editionData.identifiers.goodreads[0]}`;
    }

    if (editionData.identifiers?.openlibrary.length > 0) {
      edition.external_urls.openlibrary = `https://openlibrary.org/books/${editionData.identifiers.openlibrary[0]}`;
    }

    return edition;
  };

  private mapAuthorFragment = (
    authorData: AuthorFragment
  ): HardcoverAuthor => ({
    id: authorData.id,
    media_type: 'author',
    name: authorData.name,
    image_url: authorData.cached_image?.url || '',
    biography: authorData.bio || '',
    birth_date: authorData.born_date || '',
    death_date: authorData.death_date || '',
    location: authorData.location || '',
    popularity: authorData.users_count || 0,
    books: [],
    books_count: authorData.books_count || 0,
    alternate_names: authorData.alternate_names || [],
  });
}

export default Hardcover;
