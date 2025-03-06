import CalibreWebAPI from '@server/api/calibre';
import CalibreWebDownloader from '@server/api/calibre/downloader';
import { calibreWebFullScanner } from '@server/lib/scanners/calibre';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';

const calibreWebRoutes = Router();

calibreWebRoutes.get('/', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.calibreWeb);
});

calibreWebRoutes.post('/', async (req, res, next) => {
  const settings = getSettings();
  try {
    Object.assign(settings.calibreWeb, req.body);

    const client = new CalibreWebAPI({
      url: CalibreWebAPI.buildUrl(settings.calibreWeb),
      apiKey: settings.calibreWeb.apiKey || '',
      cacheName: 'calibreWeb',
      apiName: 'calibreWeb',
    });

    try {
      await client.getBooks({ offset: 0, limit: 1 });
    } catch (e) {
      return next({
        status: 500,
        message: 'Unable to connect to Calibre Web.',
      });
    }

    settings.save();
  } catch (e) {
    logger.error('Something went wrong testing Calibre Web connection', {
      label: 'API',
      errorMessage: e.message,
    });
    return next({
      status: 500,
      message: 'Unable to connect to Calibre Web.',
    });
  }

  return res.status(200).json(settings.calibreWeb);
});

calibreWebRoutes.get('/sync', (_req, res) => {
  return res.status(200).json(calibreWebFullScanner.status());
});

calibreWebRoutes.post('/sync', async (req, res) => {
  if (req.body.cancel) {
    calibreWebFullScanner.cancel();
  } else if (req.body.start) {
    calibreWebFullScanner.run();
  }
  return res.status(200).json(calibreWebFullScanner.status());
});

calibreWebRoutes.get('/downloader', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.calibreWebDownloader);
});

calibreWebRoutes.post('/downloader', async (req, res, next) => {
  const settings = getSettings();
  try {
    Object.assign(settings.calibreWebDownloader, req.body);

    const downloader = new CalibreWebDownloader({
      url: CalibreWebAPI.buildUrl(settings.calibreWebDownloader),
      cacheName: 'calibreWebDownloader',
      apiName: 'CalibreWebDownloader',
    });

    const result = await downloader.getStatus();

    if (!result || !('queued' in result)) {
      return next({
        status: 500,
        message: 'Unable to connect to Calibre Web Downloader.',
      });
    }

    settings.save();
  } catch (e) {
    logger.error(
      'Something went wrong testing Calibre Web Downloader connection',
      {
        label: 'API',
        errorMessage: e.message,
      }
    );
    return next({
      status: 500,
      message: 'Unable to connect to Calibre Web Downloader.',
    });
  }

  return res.status(200).json(settings.calibreWebDownloader);
});

export default calibreWebRoutes;
