import Hardcover from '@server/api/hardcover';
import { MediaType } from '@server/constants/media';
import Media from '@server/entity/Media';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { mapBookDetails } from '@server/models/Book';
import { mapBookResult } from '@server/models/Search';
import { Router } from 'express';
// import { MediaType } from '@server/constants/media';
// import Media from '@server/entity/Media';

const bookRoutes = Router();

bookRoutes.get('/:editionId', async (req, res, next) => {
  const settings = getSettings();
  const hardcover = new Hardcover({
    token: settings.hardcover.token,
  });

  try {
    const hardcoverBook = await hardcover.getBookByEditionID({
      editionId: Number(req.params.editionId),
    });

    const media = await Media.getMedia(hardcoverBook.id, MediaType.BOOK);

    return res.status(200).json(mapBookDetails(hardcoverBook, media));
  } catch (e) {
    logger.debug('Something went wrong retrieving book', {
      label: 'API',
      errorMessage: e.message,
      editionId: req.params.editionId,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve book',
    });
  }
});

bookRoutes.get('/:editionId/similar', async (req, res, next) => {
  const settings = getSettings();
  const hardcover = new Hardcover({
    token: settings.hardcover.token,
  });

  try {
    const hardcoverBookData = await hardcover.getBookByEditionID({
      editionId: Number(req.params.editionId),
    });

    const hardcoverBooksData = await hardcover.getBooksSimilar({
      bookId: Number(hardcoverBookData.bookId),
      page: Number(req.query.page),
    });

    const media = await Media.getRelatedMedia(
      hardcoverBooksData.results.map((result) => result.id)
    );

    return res.status(200).json({
      page: hardcoverBooksData.page,
      totalPages: hardcoverBooksData.total_pages,
      totalResults: hardcoverBooksData.total_results,
      results: hardcoverBooksData.results.map((result) =>
        mapBookResult(
          result,
          media.find(
            (req) =>
              req.hardcoverId === result.id && req.mediaType === MediaType.BOOK
          )
        )
      ),
    });
  } catch (e) {
    logger.debug('Something went wrong retrieving similar books', {
      label: 'API',
      errorMessage: e.message,
      editionId: req.params.editionId,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve similar books.',
    });
  }
});

bookRoutes.get('/:editionId/series', async (req, res, next) => {
  const settings = getSettings();
  const hardcover = new Hardcover({
    token: settings.hardcover.token,
  });

  try {
    const hardcoverBookData = await hardcover.getBookByEditionID({
      editionId: Number(req.params.editionId),
    });

    if (!hardcoverBookData.series) {
      return res.status(200).json({
        page: 1,
        totalPages: 1,
        totalResults: 0,
        results: [],
      });
    }

    const hardcoverBooksData = await hardcover.getBooksBySeriesID({
      seriesId: hardcoverBookData.series.id,
      page: Number(req.query.page),
    });

    const media = await Media.getRelatedMedia(
      hardcoverBooksData.results.map((result) => result.id)
    );

    return res.status(200).json({
      page: hardcoverBooksData.page,
      totalPages: hardcoverBooksData.total_pages,
      totalResults: hardcoverBooksData.total_results,
      results: hardcoverBooksData.results.map((result) =>
        mapBookResult(
          result,
          media.find(
            (req) =>
              req.hardcoverId === result.id && req.mediaType === MediaType.BOOK
          )
        )
      ),
    });
  } catch (e) {
    logger.debug('Something went wrong retrieving book series', {
      label: 'API',
      errorMessage: e.message,
      editionId: req.params.editionId,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve book series.',
    });
  }
});

export default bookRoutes;
