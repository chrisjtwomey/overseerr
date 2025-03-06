import CalibreWebAPI from '@server/api/calibre';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';

const calibreWebRoutes = Router();

calibreWebRoutes.post('/:bookId/send', async (req, res, next) => {
  const settings = getSettings();

  try {
    if (!req.user || !req.user?.settings?.calibreAPIKey) {
      return res.status(400).json({
        success: false,
        message: 'User does not have a Calibre API key set.',
      });
    }

    const calibre = new CalibreWebAPI({
      url: CalibreWebAPI.buildUrl(settings.calibreWeb),
      apiKey: settings.calibreWeb.apiKey || '',
      cacheName: 'calibreWeb',
      apiName: 'calibreWeb',
    });

    const book = await calibre.getBookById(parseInt(req.params.bookId, 10));
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found in Calibre library.',
      });
    }

    await calibre.sendToEReader({
      userAPIKey: req.user?.settings?.calibreAPIKey,
      bookId: parseInt(req.params.bookId, 10),
    });
    return res.status(200).json({ success: true });
  } catch (e) {
    logger.error('Failed to send book to eReader', {
      label: 'CalibreWeb',
      errorMessage: e.message,
    });
    return next({
      status: 500,
      message: 'Failed to send book to eReader.',
    });
  }
});

export default calibreWebRoutes;
