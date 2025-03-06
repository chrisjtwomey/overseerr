import type { CalibreWebBook } from '@server/api/calibre';
import CalibreWebAPI from '@server/api/calibre';
import TheMovieDb from '@server/api/themoviedb';
import { MediaStatus, MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MediaRequest from '@server/entity/MediaRequest';
import Season from '@server/entity/Season';
import { User } from '@server/entity/User';
import notificationManager, { Notification } from '@server/lib/notifications';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import AsyncLock from '@server/utils/asyncLock';
import { randomUUID } from 'crypto';

// Default scan rates (can be overidden)
const BUNDLE_SIZE = 20;
const UPDATE_RATE = 4 * 1000;

export type StatusBase = {
  running: boolean;
  progress: number;
  total: number;
};

export interface RunnableScanner<T> {
  run: () => Promise<void>;
  status: () => T & StatusBase;
}

export interface MediaIds {
  tmdbId?: number;
  imdbId?: string;
  tvdbId?: number;
  hardcoverId?: number;
  isbn?: string;
  asin?: string;
  isHama?: boolean;
}

interface ProcessOptions {
  is4k?: boolean;
  mediaAddedAt?: Date;
  ratingKey?: string;
  calibreBookId?: number;
  serviceId?: number;
  externalServiceId?: number;
  externalServiceSlug?: string;
  title?: string;
  processing?: boolean;
}

export interface ProcessableSeason {
  seasonNumber: number;
  totalEpisodes: number;
  episodes: number;
  episodes4k: number;
  is4kOverride?: boolean;
  processing?: boolean;
}

class BaseScanner<T> {
  private bundleSize;
  private updateRate;
  protected progress = 0;
  protected items: T[] = [];
  protected totalSize?: number = 0;
  protected scannerName: string;
  protected enable4kMovie = false;
  protected enable4kShow = false;
  protected sessionId: string;
  protected running = false;
  readonly asyncLock = new AsyncLock();
  readonly tmdb = new TheMovieDb();
  protected calibreClient: CalibreWebAPI;

  protected constructor(
    scannerName: string,
    {
      updateRate,
      bundleSize,
    }: {
      updateRate?: number;
      bundleSize?: number;
    } = {}
  ) {
    this.scannerName = scannerName;
    this.bundleSize = bundleSize ?? BUNDLE_SIZE;
    this.updateRate = updateRate ?? UPDATE_RATE;
  }

  private async getExisting(mediaId: number, mediaType: MediaType) {
    const mediaRepository = getRepository(Media);

    const existing = await mediaRepository.findOne({
      where: [
        { tmdbId: mediaId, mediaType },
        { hardcoverId: mediaId, mediaType },
      ],
    });

    return existing;
  }

  protected async processMovie(
    tmdbId: number,
    {
      is4k = false,
      mediaAddedAt,
      ratingKey,
      serviceId,
      externalServiceId,
      externalServiceSlug,
      processing = false,
      title = 'Unknown Title',
    }: ProcessOptions = {}
  ): Promise<void> {
    const mediaRepository = getRepository(Media);

    await this.asyncLock.dispatch(tmdbId, async () => {
      const existing = await this.getExisting(tmdbId, MediaType.MOVIE);

      if (existing) {
        let changedExisting = false;

        if (existing[is4k ? 'status4k' : 'status'] !== MediaStatus.AVAILABLE) {
          existing[is4k ? 'status4k' : 'status'] = processing
            ? MediaStatus.PROCESSING
            : MediaStatus.AVAILABLE;
          if (mediaAddedAt) {
            existing.mediaAddedAt = mediaAddedAt;
          }
          changedExisting = true;
        }

        if (!changedExisting && !existing.mediaAddedAt && mediaAddedAt) {
          existing.mediaAddedAt = mediaAddedAt;
          changedExisting = true;
        }

        if (
          ratingKey &&
          existing[is4k ? 'ratingKey4k' : 'ratingKey'] !== ratingKey
        ) {
          existing[is4k ? 'ratingKey4k' : 'ratingKey'] = ratingKey;
          changedExisting = true;
        }

        if (
          serviceId !== undefined &&
          existing[is4k ? 'serviceId4k' : 'serviceId'] !== serviceId
        ) {
          existing[is4k ? 'serviceId4k' : 'serviceId'] = serviceId;
          changedExisting = true;
        }

        if (
          externalServiceId !== undefined &&
          existing[is4k ? 'externalServiceId4k' : 'externalServiceId'] !==
            externalServiceId
        ) {
          existing[is4k ? 'externalServiceId4k' : 'externalServiceId'] =
            externalServiceId;
          changedExisting = true;
        }

        if (
          externalServiceSlug !== undefined &&
          existing[is4k ? 'externalServiceSlug4k' : 'externalServiceSlug'] !==
            externalServiceSlug
        ) {
          existing[is4k ? 'externalServiceSlug4k' : 'externalServiceSlug'] =
            externalServiceSlug;
          changedExisting = true;
        }

        if (changedExisting) {
          await mediaRepository.save(existing);
          this.log(
            `Media for ${title} exists. Changes were detected and the title will be updated.`,
            'info'
          );
        } else {
          this.log(`Title already exists and no changes detected for ${title}`);
        }
      } else {
        const newMedia = new Media();
        newMedia.tmdbId = tmdbId;

        newMedia.status =
          !is4k && !processing
            ? MediaStatus.AVAILABLE
            : !is4k && processing
            ? MediaStatus.PROCESSING
            : MediaStatus.UNKNOWN;
        newMedia.status4k =
          is4k && this.enable4kMovie && !processing
            ? MediaStatus.AVAILABLE
            : is4k && this.enable4kMovie && processing
            ? MediaStatus.PROCESSING
            : MediaStatus.UNKNOWN;
        newMedia.mediaType = MediaType.MOVIE;
        newMedia.serviceId = !is4k ? serviceId : undefined;
        newMedia.serviceId4k = is4k ? serviceId : undefined;
        newMedia.externalServiceId = !is4k ? externalServiceId : undefined;
        newMedia.externalServiceId4k = is4k ? externalServiceId : undefined;
        newMedia.externalServiceSlug = !is4k ? externalServiceSlug : undefined;
        newMedia.externalServiceSlug4k = is4k ? externalServiceSlug : undefined;

        if (mediaAddedAt) {
          newMedia.mediaAddedAt = mediaAddedAt;
        }

        if (ratingKey) {
          newMedia.ratingKey = !is4k ? ratingKey : undefined;
          newMedia.ratingKey4k =
            is4k && this.enable4kMovie ? ratingKey : undefined;
        }
        await mediaRepository.save(newMedia);
        this.log(`Saved new media: ${title}`);
      }
    });
  }

  /**
   * processShow takes a TMDB ID and an array of ProcessableSeasons, which
   * should include the total episodes a sesaon has + the total available
   * episodes that each season currently has. Unlike processMovie, this method
   * does not take an `is4k` option. We handle both the 4k _and_ non 4k status
   * in one method.
   *
   * Note: If 4k is not enable, ProcessableSeasons should combine their episode counts
   * into the normal episodes properties and avoid using the 4k properties.
   */
  protected async processShow(
    tmdbId: number,
    tvdbId: number,
    seasons: ProcessableSeason[],
    {
      mediaAddedAt,
      ratingKey,
      serviceId,
      externalServiceId,
      externalServiceSlug,
      is4k = false,
      title = 'Unknown Title',
    }: ProcessOptions = {}
  ): Promise<void> {
    const mediaRepository = getRepository(Media);

    await this.asyncLock.dispatch(tmdbId, async () => {
      const media = await this.getExisting(tmdbId, MediaType.TV);

      const newSeasons: Season[] = [];

      const currentStandardSeasonsAvailable = (
        media?.seasons.filter(
          (season) => season.status === MediaStatus.AVAILABLE
        ) ?? []
      ).length;

      const current4kSeasonsAvailable = (
        media?.seasons.filter(
          (season) => season.status4k === MediaStatus.AVAILABLE
        ) ?? []
      ).length;

      for (const season of seasons) {
        const existingSeason = media?.seasons.find(
          (es) => es.seasonNumber === season.seasonNumber
        );

        // We update the rating keys in the seasons loop because we need episode counts
        if (media && season.episodes > 0 && media.ratingKey !== ratingKey) {
          media.ratingKey = ratingKey;
        }

        if (
          media &&
          season.episodes4k > 0 &&
          this.enable4kShow &&
          media.ratingKey4k !== ratingKey
        ) {
          media.ratingKey4k = ratingKey;
        }

        if (existingSeason) {
          // Here we update seasons if they already exist.
          // If the season is already marked as available, we
          // force it to stay available (to avoid competing scanners)
          existingSeason.status =
            (season.totalEpisodes === season.episodes && season.episodes > 0) ||
            existingSeason.status === MediaStatus.AVAILABLE
              ? MediaStatus.AVAILABLE
              : season.episodes > 0
              ? MediaStatus.PARTIALLY_AVAILABLE
              : !season.is4kOverride &&
                season.processing &&
                existingSeason.status !== MediaStatus.DELETED
              ? MediaStatus.PROCESSING
              : existingSeason.status;

          // Same thing here, except we only do updates if 4k is enabled
          existingSeason.status4k =
            (this.enable4kShow &&
              season.episodes4k === season.totalEpisodes &&
              season.episodes4k > 0) ||
            existingSeason.status4k === MediaStatus.AVAILABLE
              ? MediaStatus.AVAILABLE
              : this.enable4kShow && season.episodes4k > 0
              ? MediaStatus.PARTIALLY_AVAILABLE
              : season.is4kOverride &&
                season.processing &&
                existingSeason.status4k !== MediaStatus.DELETED
              ? MediaStatus.PROCESSING
              : existingSeason.status4k;
        } else {
          newSeasons.push(
            new Season({
              seasonNumber: season.seasonNumber,
              status:
                season.totalEpisodes === season.episodes && season.episodes > 0
                  ? MediaStatus.AVAILABLE
                  : season.episodes > 0
                  ? MediaStatus.PARTIALLY_AVAILABLE
                  : !season.is4kOverride && season.processing
                  ? MediaStatus.PROCESSING
                  : MediaStatus.UNKNOWN,
              status4k:
                this.enable4kShow &&
                season.totalEpisodes === season.episodes4k &&
                season.episodes4k > 0
                  ? MediaStatus.AVAILABLE
                  : this.enable4kShow && season.episodes4k > 0
                  ? MediaStatus.PARTIALLY_AVAILABLE
                  : season.is4kOverride && season.processing
                  ? MediaStatus.PROCESSING
                  : MediaStatus.UNKNOWN,
            })
          );
        }
      }

      // We want to skip specials when checking if a show is available
      const isAllStandardSeasons =
        seasons.length &&
        seasons
          .filter((season) => season.seasonNumber !== 0)
          .every(
            (season) =>
              season.episodes === season.totalEpisodes && season.episodes > 0
          );

      const isAll4kSeasons =
        seasons.length &&
        seasons
          .filter((season) => season.seasonNumber !== 0)
          .every(
            (season) =>
              season.episodes4k === season.totalEpisodes &&
              season.episodes4k > 0
          );

      if (media) {
        media.seasons = [...media.seasons, ...newSeasons];

        const newStandardSeasonsAvailable = (
          media.seasons.filter(
            (season) => season.status === MediaStatus.AVAILABLE
          ) ?? []
        ).length;

        const new4kSeasonsAvailable = (
          media.seasons.filter(
            (season) => season.status4k === MediaStatus.AVAILABLE
          ) ?? []
        ).length;

        // If at least one new season has become available, update
        // the lastSeasonChange field so we can trigger notifications
        if (newStandardSeasonsAvailable > currentStandardSeasonsAvailable) {
          this.log(
            `Detected ${
              newStandardSeasonsAvailable - currentStandardSeasonsAvailable
            } new standard season(s) for ${title}`,
            'debug'
          );
          media.lastSeasonChange = new Date();

          if (mediaAddedAt) {
            media.mediaAddedAt = mediaAddedAt;
          }
        }

        if (new4kSeasonsAvailable > current4kSeasonsAvailable) {
          this.log(
            `Detected ${
              new4kSeasonsAvailable - current4kSeasonsAvailable
            } new 4K season(s) for ${title}`,
            'debug'
          );
          media.lastSeasonChange = new Date();
        }

        if (!media.mediaAddedAt && mediaAddedAt) {
          media.mediaAddedAt = mediaAddedAt;
        }

        if (serviceId !== undefined) {
          media[is4k ? 'serviceId4k' : 'serviceId'] = serviceId;
        }

        if (externalServiceId !== undefined) {
          media[is4k ? 'externalServiceId4k' : 'externalServiceId'] =
            externalServiceId;
        }

        if (externalServiceSlug !== undefined) {
          media[is4k ? 'externalServiceSlug4k' : 'externalServiceSlug'] =
            externalServiceSlug;
        }

        // If the show is already available, and there are no new seasons, dont adjust
        // the status. Skip specials when performing availability check
        const shouldStayAvailable =
          media.status === MediaStatus.AVAILABLE &&
          newSeasons.filter(
            (season) =>
              season.status !== MediaStatus.UNKNOWN &&
              season.status !== MediaStatus.DELETED &&
              season.seasonNumber !== 0
          ).length === 0;
        const shouldStayAvailable4k =
          media.status4k === MediaStatus.AVAILABLE &&
          newSeasons.filter(
            (season) =>
              season.status4k !== MediaStatus.UNKNOWN &&
              season.status4k !== MediaStatus.DELETED &&
              season.seasonNumber !== 0
          ).length === 0;
        media.status =
          isAllStandardSeasons || shouldStayAvailable
            ? MediaStatus.AVAILABLE
            : media.seasons.some(
                (season) =>
                  season.status === MediaStatus.PARTIALLY_AVAILABLE ||
                  season.status === MediaStatus.AVAILABLE
              )
            ? MediaStatus.PARTIALLY_AVAILABLE
            : (!seasons.length && media.status !== MediaStatus.DELETED) ||
              media.seasons.some(
                (season) => season.status === MediaStatus.PROCESSING
              )
            ? MediaStatus.PROCESSING
            : media.status === MediaStatus.DELETED
            ? MediaStatus.DELETED
            : MediaStatus.UNKNOWN;
        media.status4k =
          (isAll4kSeasons || shouldStayAvailable4k) && this.enable4kShow
            ? MediaStatus.AVAILABLE
            : this.enable4kShow &&
              media.seasons.some(
                (season) =>
                  season.status4k === MediaStatus.PARTIALLY_AVAILABLE ||
                  season.status4k === MediaStatus.AVAILABLE
              )
            ? MediaStatus.PARTIALLY_AVAILABLE
            : (!seasons.length && media.status4k !== MediaStatus.DELETED) ||
              media.seasons.some(
                (season) => season.status4k === MediaStatus.PROCESSING
              )
            ? MediaStatus.PROCESSING
            : media.status4k === MediaStatus.DELETED
            ? MediaStatus.DELETED
            : MediaStatus.UNKNOWN;
        await mediaRepository.save(media);
        this.log(`Updating existing title: ${title}`);
      } else {
        const newMedia = new Media({
          mediaType: MediaType.TV,
          seasons: newSeasons,
          tmdbId,
          tvdbId,
          mediaAddedAt,
          serviceId: !is4k ? serviceId : undefined,
          serviceId4k: is4k ? serviceId : undefined,
          externalServiceId: !is4k ? externalServiceId : undefined,
          externalServiceId4k: is4k ? externalServiceId : undefined,
          externalServiceSlug: !is4k ? externalServiceSlug : undefined,
          externalServiceSlug4k: is4k ? externalServiceSlug : undefined,
          ratingKey: newSeasons.some(
            (sn) =>
              sn.status === MediaStatus.PARTIALLY_AVAILABLE ||
              sn.status === MediaStatus.AVAILABLE
          )
            ? ratingKey
            : undefined,
          ratingKey4k:
            this.enable4kShow &&
            newSeasons.some(
              (sn) =>
                sn.status4k === MediaStatus.PARTIALLY_AVAILABLE ||
                sn.status4k === MediaStatus.AVAILABLE
            )
              ? ratingKey
              : undefined,
          status: isAllStandardSeasons
            ? MediaStatus.AVAILABLE
            : newSeasons.some(
                (season) =>
                  season.status === MediaStatus.PARTIALLY_AVAILABLE ||
                  season.status === MediaStatus.AVAILABLE
              )
            ? MediaStatus.PARTIALLY_AVAILABLE
            : newSeasons.some(
                (season) => season.status === MediaStatus.PROCESSING
              )
            ? MediaStatus.PROCESSING
            : MediaStatus.UNKNOWN,
          status4k:
            isAll4kSeasons && this.enable4kShow
              ? MediaStatus.AVAILABLE
              : this.enable4kShow &&
                newSeasons.some(
                  (season) =>
                    season.status4k === MediaStatus.PARTIALLY_AVAILABLE ||
                    season.status4k === MediaStatus.AVAILABLE
                )
              ? MediaStatus.PARTIALLY_AVAILABLE
              : newSeasons.some(
                  (season) => season.status4k === MediaStatus.PROCESSING
                )
              ? MediaStatus.PROCESSING
              : MediaStatus.UNKNOWN,
        });
        await mediaRepository.save(newMedia);
        this.log(`Saved ${title}`);
      }
    });
  }

  protected async processBook(
    hardcoverId: number,
    {
      mediaAddedAt,
      calibreBookId,
      serviceId,
      externalServiceId,
      externalServiceSlug,
      processing = false,
      title = 'Unknown Title',
    }: ProcessOptions = {}
  ): Promise<void> {
    const mediaRepository = getRepository(Media);
    await this.asyncLock.dispatch(hardcoverId, async () => {
      const existing = await this.getExisting(hardcoverId, MediaType.BOOK);
      if (existing) {
        let changedExisting = false;
        if (existing.status !== MediaStatus.AVAILABLE) {
          existing.status = processing
            ? MediaStatus.PROCESSING
            : MediaStatus.AVAILABLE;
          if (mediaAddedAt) {
            existing.mediaAddedAt = mediaAddedAt;
          }
          changedExisting = true;
        }
        if (!changedExisting && !existing.mediaAddedAt && mediaAddedAt) {
          existing.mediaAddedAt = mediaAddedAt;
          changedExisting = true;
        }
        if (serviceId !== undefined && existing.serviceId !== serviceId) {
          existing.serviceId = serviceId;
          changedExisting = true;
        }
        if (
          externalServiceId !== undefined &&
          existing.externalServiceId !== externalServiceId
        ) {
          existing.externalServiceId = externalServiceId;
          changedExisting = true;
        }
        if (
          externalServiceSlug !== undefined &&
          existing.externalServiceSlug !== externalServiceSlug
        ) {
          existing.externalServiceSlug = externalServiceSlug;
          changedExisting = true;
        }

        if (
          calibreBookId !== undefined &&
          existing.calibreBookId !== calibreBookId
        ) {
          existing.calibreBookId = calibreBookId;
          changedExisting = true;
        }

        if (changedExisting) {
          await mediaRepository.save(existing);
          this.log(
            `Media for ${title} exists. Changes were detected and the title will be updated.`,
            'info'
          );

          if (existing.status !== MediaStatus.AVAILABLE) {
            return;
          }

          // Get the media request to get the requestedBy user
          const requestRepository = getRepository(MediaRequest);
          const request = await requestRepository
            .createQueryBuilder('request')
            .leftJoin('request.media', 'media')
            .leftJoinAndSelect('request.requestedBy', 'user')
            .where('media.hardcoverId = :hardcoverId', {
              hardcoverId: hardcoverId,
            })
            .andWhere('media.mediaType = :mediaType', {
              mediaType: MediaType.BOOK,
            })
            .getOne();

          if (!request || !request.requestedBy) {
            return;
          }

          const userRepository = getRepository(User);
          const userId = request.requestedBy.id;
          // Fetch the user with their settings
          const user = await userRepository
            .createQueryBuilder('user')
            .where('user.id = :userId', { userId })
            .leftJoinAndSelect('user.settings', 'settings')
            .getOne();

          if (!user || !user.settings) {
            this.log(
              `User ${userId} not found or settings not available for book '${title}'`,
              'error',
              { userId, title }
            );
            return;
          }

          if (
            !user.settings?.autoSendAvailableRequestedBooks ||
            !user.settings.calibreAPIKey
          ) {
            return;
          }
          this.log(
            `Sending book '${title}' to user ${user.id}'s eReader`,
            'info',
            { userId: user.id, title }
          );

          if (!this.calibreClient) {
            const settings = getSettings();
            this.calibreClient = new CalibreWebAPI({
              url: CalibreWebAPI.buildUrl(settings.calibreWeb),
              apiKey: settings.calibreWeb.apiKey || '',
              cacheName: 'calibreWeb',
              apiName: 'calibreWeb',
            });
          }

          let calibreBook: CalibreWebBook | undefined;
          try {
            calibreBook = await this.calibreClient.getBookByHardcoverId(
              hardcoverId
            );
          } catch (e) {
            if (existing.calibreBookId) {
              calibreBook = await this.calibreClient.getBookById(
                existing.calibreBookId
              );
            }
          }

          if (!calibreBook) {
            this.log(
              `No Calibre book for hardcoverId ${hardcoverId} to send to eReader`,
              'error',
              { hardcoverId }
            );
            return;
          }

          try {
            await this.calibreClient.sendToEReader({
              userAPIKey: user.settings.calibreAPIKey,
              bookId: calibreBook.id,
            });

            notificationManager.sendNotification(
              Notification.BOOK_SEND_SUCCESS,
              {
                event: `${title} has been sent to eReader`,
                subject: title,
                media: existing,
                notifyAdmin: false,
                notifySystem: false,
                notifyUser: user,
              }
            );
          } catch (e) {
            this.log(
              `Failed to send book '${title}' to user ${user.id}'s eReader: ${e.message}`,
              'error',
              { userId: user.id, title, error: e.message }
            );
            return;
          }
        } else {
          this.log(`Title already exists and no changes detected for ${title}`);
        }
      } else {
        const newMedia = new Media();
        newMedia.hardcoverId = hardcoverId;
        newMedia.status = !processing
          ? MediaStatus.AVAILABLE
          : MediaStatus.PROCESSING;
        newMedia.mediaType = MediaType.BOOK;
        newMedia.serviceId = serviceId;
        newMedia.externalServiceId = externalServiceId;
        newMedia.externalServiceSlug = externalServiceSlug;
        if (mediaAddedAt) {
          newMedia.mediaAddedAt = mediaAddedAt;
        }
        await mediaRepository.save(newMedia);
        this.log(`Saved new media: ${title}`);
      }
    });
  }

  /**
   * Call startRun from child class whenever a run is starting to
   * ensure required values are set
   *
   * Returns the session ID which is requried for the cleanup method
   */
  protected startRun(): string {
    const settings = getSettings();
    const sessionId = randomUUID();
    this.sessionId = sessionId;

    this.log('Scan starting', 'info', { sessionId });

    this.enable4kMovie = settings.radarr.some((radarr) => radarr.is4k);
    if (this.enable4kMovie) {
      this.log(
        'At least one 4K Radarr server was detected. 4K movie detection is now enabled',
        'info'
      );
    }

    this.enable4kShow = settings.sonarr.some((sonarr) => sonarr.is4k);
    if (this.enable4kShow) {
      this.log(
        'At least one 4K Sonarr server was detected. 4K series detection is now enabled',
        'info'
      );
    }

    this.running = true;

    return sessionId;
  }

  /**
   * Call at end of run loop to perform cleanup
   */
  protected endRun(sessionId: string): void {
    if (this.sessionId === sessionId) {
      this.running = false;
    }
  }

  public cancel(): void {
    this.running = false;
  }

  protected async loop(
    processFn: (item: T) => Promise<void>,
    {
      start = 0,
      end = this.bundleSize,
      sessionId,
    }: {
      start?: number;
      end?: number;
      sessionId?: string;
    } = {}
  ): Promise<void> {
    const slicedItems = this.items.slice(start, end);

    if (!this.running) {
      throw new Error('Sync was aborted.');
    }

    if (this.sessionId !== sessionId) {
      throw new Error('New session was started. Old session aborted.');
    }

    if (start < this.items.length) {
      this.progress = start;
      await this.processItems(processFn, slicedItems);

      await new Promise<void>((resolve, reject) =>
        setTimeout(() => {
          this.loop(processFn, {
            start: start + this.bundleSize,
            end: end + this.bundleSize,
            sessionId,
          })
            .then(() => resolve())
            .catch((e) => reject(new Error(e.message)));
        }, this.updateRate)
      );
    }
  }

  private async processItems(
    processFn: (items: T) => Promise<void>,
    items: T[]
  ) {
    await Promise.all(
      items.map(async (item) => {
        await processFn(item);
      })
    );
  }

  protected log(
    message: string,
    level: 'info' | 'error' | 'debug' | 'warn' = 'debug',
    optional?: Record<string, unknown>
  ): void {
    logger[level](message, { label: this.scannerName, ...optional });
  }

  get protectedUpdateRate(): number {
    return this.updateRate;
  }

  get protectedBundleSize(): number {
    return this.bundleSize;
  }
}

export default BaseScanner;
