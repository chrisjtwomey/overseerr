import type { BookDetails } from '@server/models/Book';

export interface AuthorBooksResponse {
  results: BookDetails[];
}
