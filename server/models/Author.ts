import type { HardcoverAuthor } from '@server/api/hardcover/interfaces';
import type { EntityDetails } from './common';

export interface AuthorDetails extends EntityDetails {
  type: 'author';
  id: number;
  name: string;
  birthday: string;
  deathday: string;
  alsoKnownAs?: string[];
  biography: string;
  popularity: number;
  placeOfBirth?: string;
  profilePath?: string;
  booksCount: number;
}

export const mapAuthorDetails = (
  authorResult: HardcoverAuthor
): AuthorDetails => ({
  type: 'author',
  id: authorResult.id,
  name: authorResult.name,
  birthday: authorResult.birth_date,
  deathday: authorResult.death_date,
  alsoKnownAs: authorResult.alternate_names.slice(0, 3),
  biography: authorResult.biography,
  popularity: authorResult.popularity,
  placeOfBirth: authorResult.location,
  profilePath: authorResult.image_url,
  booksCount: authorResult.books_count,
});
