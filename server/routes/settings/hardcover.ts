import Hardcover from '@server/api/hardcover';
import { hardcoverCacheSync } from '@server/lib/scanners/hardcover';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';

const hardcoverRoutes = Router();

hardcoverRoutes.get('/', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.hardcover);
});

hardcoverRoutes.post('/', async (req, res, next) => {
  const settings = getSettings();
  try {
    Object.assign(settings.hardcover, req.body);

    const hardcover = new Hardcover({
      token: settings.hardcover.token || '',
    });

    try {
      await hardcover.testConnection();
      settings.save();

      hardcoverCacheSync.run();
    } catch (e) {
      return next({
        status: 500,
        message: 'Unable to connect to Hardcover.',
      });
    }
  } catch (e) {
    logger.error('Something went wrong testing Hardcover connection', {
      label: 'API',
      errorMessage: e.message,
    });
    return next({
      status: 500,
      message: 'Unable to connect to Hardcover.',
    });
  }

  return res.status(200).json(settings.hardcover);
});

export default hardcoverRoutes;
