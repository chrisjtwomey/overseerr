import Hardcover from '@server/api/hardcover';
import type { HardcoverBook } from '@server/api/hardcover/interfaces';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { mapAuthorDetails } from '@server/models/Author';
import { mapBookDetails } from '@server/models/Book';
import { Router } from 'express';
// import { MediaType } from '@server/constants/media';
// import Media from '@server/entity/Media';

const authorRoutes = Router();

authorRoutes.get('/:authorId', async (req, res, next) => {
  const settings = getSettings();
  const hardcover = new Hardcover({
    token: settings.hardcover.token,
  });

  try {
    const hardcoverAuthor = await hardcover.getAuthor({
      authorId: Number(req.params.authorId),
    });

    // const media = await Media.getMedia(hardcoverBook.id, MediaType.BOOK);

    return res.status(200).json(mapAuthorDetails(hardcoverAuthor));
  } catch (e) {
    logger.debug('Something went wrong retrieving book', {
      label: 'API',
      errorMessage: e.message,
      bookId: req.params.authorId,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve book',
    });
  }
});

authorRoutes.get('/:authorId/books', async (req, res, next) => {
  const settings = getSettings();
  const hardcover = new Hardcover({
    token: settings.hardcover.token,
  });

  try {
    const hardcoverBooksData = await hardcover.getAuthorBooks({
      authorId: Number(req.params.authorId),
      page: Number(req.query.page),
    });

    // const media = await Media.getRelatedMedia(
    //   results.results.map((result) => result.id)
    // );

    const books = hardcoverBooksData.results.map((book) =>
      mapBookDetails(book as HardcoverBook)
    );

    return res.status(200).json({
      page: hardcoverBooksData.page,
      totalPages: hardcoverBooksData.total_pages,
      totalResults: hardcoverBooksData.total_results,
      results: books,
    });
  } catch (e) {
    logger.debug('Something went wrong retrieving author books', {
      label: 'API',
      errorMessage: e.message,
      authorId: req.params.authorId,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve author books.',
    });
  }
});

export default authorRoutes;
