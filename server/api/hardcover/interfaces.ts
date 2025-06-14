export interface HardcoverAuthor {
  id: number;
  media_type: 'author';
  name: string;
  alternate_names: string[];
  image_url: string;
  biography: string;
  birth_date: string;
  death_date: string;
  location: string;
  popularity: number;
  books: HardcoverBook[];
  books_count: number;
}

export interface HardcoverPublisher {
  id: number;
  name: string;
}

export interface HardcoverLanguage {
  name: string;
  code: string;
}

export interface HardcoverExternalUrls {
  hardcover?: string;
  isbndb?: string;
  goodreads?: string;
  openlibrary?: string;
  amazon?: string;
}

export interface HardcoverEdition {
  id: number;
  ISBN?: string;
  ASIN?: string;
  title: string;
  description: string;
  release_date: string;
  pages: number;
  publisher?: HardcoverPublisher;
  language?: HardcoverLanguage;
  external_urls: HardcoverExternalUrls;
}

export interface HardcoverBookPreview {
  media_type: 'book';
  id: number;
  bookId: number;
  identifiers: string[];
  title: string;
  description: string;
  image_url: string;
  rating: number;
  release_date: string;
}

export interface HardcoverBook extends HardcoverBookPreview {
  original_title: string;
  original_release_date: string;
  language?: HardcoverLanguage;
  original_language?: HardcoverLanguage;
  authors: HardcoverAuthor[];
  publisher?: HardcoverPublisher;
  original_publisher?: HardcoverPublisher;
  series?: HardcoverFeaturedSeries;
  headline?: string;
  ratings_count: number;
  pages: number;
  genres: HardcoverTag[];
  moods: HardcoverTag[];
  external_ids: {
    isbn?: string;
    asin?: string;
    hardcover_id?: number;
    goodreads_id?: number;
    open_library_id?: string;
  };
  external_urls: HardcoverExternalUrls;
  series_ids?: number[];
  status: 'Published' | 'Not released' | 'Unknown';
}

export interface HardcoverFeaturedSeries {
  id: number;
  name: string;
  position: number;
  books_count: number;
}

export interface HardcoverBookSeries {
  id: number;
  title: string;
  primary_books_count: number;
  books: HardcoverBook[];
}

export interface HardcoverCachedTags {
  genres: HardcoverTag[];
  moods: HardcoverTag[];
}

export interface HardcoverTag {
  id: number;
  type: 'genre' | 'mood';
  name: string;
  backdrops: string[];
}

export interface HardcoverPaginatedResponse {
  page: number;
  total_results: number;
  total_pages: number;
}

export interface HardcoverSearchBookResponse
  extends HardcoverPaginatedResponse {
  results: HardcoverBook[];
}

export interface HardcoverSearchAuthorResponse
  extends HardcoverPaginatedResponse {
  results: HardcoverAuthor[];
}

export interface HardcoverSearchMultiResponse
  extends HardcoverPaginatedResponse {
  results: (HardcoverBook | HardcoverAuthor)[];
}

export interface HardcoverSearchBookSeriesResponse
  extends HardcoverPaginatedResponse {
  results: HardcoverBookSeries[];
}
