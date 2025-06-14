import type {
  HardcoverAuthor,
  HardcoverBook,
  HardcoverFeaturedSeries,
  HardcoverPublisher,
} from '@server/api/hardcover/interfaces';
import type Media from '@server/entity/Media';
import type { EntityDetails, Genre, Keyword } from './common';

export interface BookDetails extends EntityDetails {
  type: 'book';
  id: number;
  identifiers: string[];
  title: string;
  originalTitle?: string;
  releaseDate: string;
  originalReleaseDate?: string;
  language: string;
  languageCode: string;
  authors: HardcoverAuthor[];
  publisher?: HardcoverPublisher;
  originalPublisher?: HardcoverPublisher;
  series?: HardcoverFeaturedSeries;
  tagline?: string;
  overview?: string;
  pages: number;
  posterPath?: string;
  backdropPath?: string;
  genres: Genre[];
  keywords: Keyword[];
  popularity: number;
  voteAverage: number;
  voteCount: number;
  status: string;
  url: string;
  mediaInfo?: Media;
}

export const mapBookDetails = (
  bookResult: HardcoverBook,
  media?: Media
): BookDetails => ({
  type: 'book',
  id: bookResult.id,
  identifiers: bookResult.identifiers,
  title: bookResult.title,
  originalTitle: bookResult.original_title,
  releaseDate: bookResult.release_date,
  originalReleaseDate: bookResult.original_release_date,
  language: bookResult.language?.name || 'Unknown',
  languageCode: bookResult.language?.code || 'en',
  publisher: bookResult.publisher,
  originalPublisher: bookResult.original_publisher,
  authors: bookResult.authors,
  series: bookResult.series,
  genres: bookResult.genres,
  keywords: bookResult.moods,
  tagline: bookResult.headline,
  overview: bookResult.description || bookResult.headline,
  pages: bookResult.pages,
  popularity: 0, // TODO: users_count
  posterPath: bookResult.image_url,
  backdropPath: bookResult.image_url,
  voteAverage: bookResult.rating,
  voteCount: bookResult.ratings_count,
  status: bookResult.status,
  url: bookResult.url,
  mediaInfo: media,
});
