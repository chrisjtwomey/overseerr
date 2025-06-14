import HardcoverLogo from '@app/assets/hardcover_logo.svg';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import type { PlayButtonLink } from '@app/components/Common/PlayButton';
import PlayButton from '@app/components/Common/PlayButton';
import Tag from '@app/components/Common/Tag';
import Tooltip from '@app/components/Common/Tooltip';
import ExternalLinkBlock from '@app/components/ExternalLinkBlock';
import IssueModal from '@app/components/IssueModal';
import ManageSlideOver from '@app/components/ManageSlideOver';
import MediaSlider from '@app/components/MediaSlider';
import RequestButton from '@app/components/RequestButton';
import StatusBadge from '@app/components/StatusBadge';
import useDeepLinks from '@app/hooks/useDeepLinks';
import useLocale from '@app/hooks/useLocale';
import useSettings from '@app/hooks/useSettings';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import Error from '@app/pages/_error';
import { refreshIntervalHelper } from '@app/utils/refreshIntervalHelper';
import { CogIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { BookOpenIcon, DeviceTabletIcon } from '@heroicons/react/24/solid';
import { IssueStatus } from '@server/constants/issue';
import { MediaStatus } from '@server/constants/media';
import type { BookDetails as BookDetailsType } from '@server/models/Book';
import axios from 'axios';
import 'country-flag-icons/3x2/flags.css';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages({
  originaltitle: 'Original Title',
  releasedate:
    '{releaseCount, plural, one {Release Date} other {Release Dates}}',
  originallanguage: 'Original Language',
  overview: 'Overview',
  pages: '{pages} pages',
  recommendations: 'Recommendations',
  similar: 'Similar Titles',
  series: 'Book #{seriesPosition} in the {name} Series',
  publisher: 'Publisher',
  overviewunavailable: 'Overview unavailable.',
  markavailable: 'Mark as Available',
  managebook: 'Manage Book',
  showmore: 'Show More',
  showless: 'Show Less',
  reportissue: 'Report an Issue',
  hardcoveruserscore: 'Hardcover User Score',
  openincalibreweb: 'Open in Calibre Web',
  sendtoereader: 'Send to eReader',
  sendsuccess: 'Successfully sent to eReader.',
  sendfailed: 'Failed to send to eReader.',
});

interface BookDetailsProps {
  book?: BookDetailsType;
}

const BookDetails = ({ book }: BookDetailsProps) => {
  const settings = useSettings();
  const { hasPermission, user } = useUser();
  const router = useRouter();
  const intl = useIntl();
  const { locale } = useLocale();
  const { addToast } = useToasts();
  const [showManager, setShowManager] = useState(
    router.query.manage == '1' ? true : false
  );
  const [showIssueModal, setShowIssueModal] = useState(false);

  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<BookDetailsType>(`/api/v1/book/${router.query.bookId}`, {
    fallbackData: book,
    refreshInterval: refreshIntervalHelper(
      {
        downloadStatus: book?.mediaInfo?.downloadStatus,
        downloadStatus4k: book?.mediaInfo?.downloadStatus4k,
      },
      15000
    ),
  });

  const sendToEReader = async () => {
    try {
      await axios.post(
        `/api/v1/calibreweb/${data?.mediaInfo?.calibreBookId}/send`
      );

      addToast(intl.formatMessage(messages.sendsuccess), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (e) {
      addToast(intl.formatMessage(messages.sendfailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  useEffect(() => {
    setShowManager(router.query.manage == '1' ? true : false);
  }, [router.query.manage]);

  const { calibreWebUrl } = useDeepLinks({
    calibreWebUrl: data?.mediaInfo?.calibreWebUrl,
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <Error statusCode={404} />;
  }

  const mediaLinks: PlayButtonLink[] = [];
  const bookAttributes: React.ReactNode[] = [];

  if (
    calibreWebUrl &&
    hasPermission([Permission.REQUEST, Permission.REQUEST_BOOK], {
      type: 'or',
    })
  ) {
    if (user?.settings?.calibreAPIKey && data.mediaInfo?.calibreBookId) {
      // add api post to send to ereader
      mediaLinks.push({
        text: intl.formatMessage(messages.sendtoereader),
        onClick: () => sendToEReader(),
        svg: <DeviceTabletIcon />,
      });
    }
    mediaLinks.push({
      text: intl.formatMessage(messages.openincalibreweb),
      url: calibreWebUrl,
      svg: <BookOpenIcon />,
    });
  }

  if (data.pages) {
    bookAttributes.push(
      intl.formatMessage(messages.pages, { pages: data.pages })
    );
  }

  if (data.genres.length) {
    bookAttributes.push(
      data.genres
        .slice(0, 4)
        .map((g) => (
          <Link href={`/discover/books?genre=${g.id}`} key={`genre-${g.id}`}>
            <a className="hover:underline">
              {g.name[0].toUpperCase() + g.name.slice(1)}
            </a>
          </Link>
        ))
        .reduce((prev, curr) => (
          <>
            {intl.formatMessage(globalMessages.delimitedlist, {
              a: prev,
              b: curr,
            })}
          </>
        ))
    );
  }

  return (
    <div
      className="media-page"
      style={{
        height: 493,
      }}
    >
      {data.backdropPath && (
        <div className="media-page-bg-image">
          <CachedImage
            alt=""
            src={`${data.backdropPath}`}
            layout="fill"
            objectFit="cover"
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(180deg, rgba(17, 24, 39, 0.70) 0%, rgba(17, 24, 39, 1) 100%)',
            }}
          />
        </div>
      )}
      <PageTitle title={data.title} />
      <IssueModal
        onCancel={() => setShowIssueModal(false)}
        show={showIssueModal}
        mediaType="book"
        mediaId={data.id}
      />
      <ManageSlideOver
        data={data}
        mediaType="book"
        onClose={() => {
          setShowManager(false);
          router.push({
            pathname: router.pathname,
            query: { bookId: router.query.bookId },
          });
        }}
        revalidate={() => revalidate()}
        show={showManager}
      />
      <div className="media-header">
        <div className="media-poster">
          <CachedImage
            src={
              data.posterPath
                ? `${data.posterPath}`
                : '/images/overseerr_poster_not_found.png'
            }
            alt=""
            layout="responsive"
            width={600}
            height={900}
            priority
          />
        </div>
        <div className="media-title">
          <div className="media-status">
            <StatusBadge
              status={data.mediaInfo?.status}
              downloadItem={data.mediaInfo?.downloadStatus}
              title={data.title}
              inProgress={(data.mediaInfo?.downloadStatus ?? []).length > 0}
              hardcoverId={data.mediaInfo?.hardcoverId}
              mediaType="book"
              calibreWebUrl={calibreWebUrl}
              serviceUrl={data.mediaInfo?.serviceUrl}
            />
          </div>
          <h1 data-testid="media-title">
            {data.title}{' '}
            {data.releaseDate && (
              <span className="media-year">
                ({data.releaseDate.slice(0, 4)})
              </span>
            )}
          </h1>
          <span className="media-attributes">
            {bookAttributes.length > 0 &&
              bookAttributes
                .map((t, k) => <span key={k}>{t}</span>)
                .reduce((prev, curr) => (
                  <>
                    {prev}
                    <span>|</span>
                    {curr}
                  </>
                ))}
          </span>
        </div>
        <div className="media-actions">
          <PlayButton links={mediaLinks} />
          <RequestButton
            mediaType="book"
            media={data.mediaInfo}
            mediaId={data.id}
            onUpdate={() => revalidate()}
          />
          {(data.mediaInfo?.status === MediaStatus.AVAILABLE ||
            (settings.currentSettings.movie4kEnabled &&
              hasPermission(
                [Permission.REQUEST_4K, Permission.REQUEST_4K_MOVIE],
                {
                  type: 'or',
                }
              ) &&
              data.mediaInfo?.status4k === MediaStatus.AVAILABLE)) &&
            hasPermission(
              [Permission.CREATE_ISSUES, Permission.MANAGE_ISSUES],
              {
                type: 'or',
              }
            ) && (
              <Tooltip content={intl.formatMessage(messages.reportissue)}>
                <Button
                  buttonType="warning"
                  onClick={() => setShowIssueModal(true)}
                  className="ml-2 first:ml-0"
                >
                  <ExclamationTriangleIcon />
                </Button>
              </Tooltip>
            )}
          {hasPermission(Permission.MANAGE_REQUESTS) && data.mediaInfo && (
            <Tooltip content={intl.formatMessage(messages.managebook)}>
              <Button
                buttonType="ghost"
                onClick={() => setShowManager(true)}
                className="relative ml-2 first:ml-0"
              >
                <CogIcon className="!mr-0" />
                {hasPermission(
                  [Permission.MANAGE_ISSUES, Permission.VIEW_ISSUES],
                  {
                    type: 'or',
                  }
                ) &&
                  (
                    data.mediaInfo?.issues.filter(
                      (issue) => issue.status === IssueStatus.OPEN
                    ) ?? []
                  ).length > 0 && (
                    <>
                      <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-600" />
                      <div className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-red-600" />
                    </>
                  )}
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="media-overview">
        <div className="media-overview-left">
          {data.tagline && <div className="tagline">{data.tagline}</div>}
          <h2>{intl.formatMessage(messages.overview)}</h2>
          <p>
            {data.overview
              ? data.overview
              : intl.formatMessage(messages.overviewunavailable)}
          </p>
          {data.authors.length > 0 && (
            <>
              <ul className="media-crew">
                {data.authors.slice(0, 6).map((author) => (
                  <li key={`author-${author.id}`}>
                    <span>Author</span>
                    <Link href={`/author/${author.id}`}>
                      <a className="crew-name">{author.name}</a>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {data.keywords.length > 0 && (
            <div className="mt-6">
              {data.keywords.map((keyword) => (
                <Link
                  href={`/discover/books?keywords=${keyword.id}`}
                  key={`keyword-id-${keyword.id}`}
                >
                  <a className="mb-2 mr-2 inline-flex last:mr-0">
                    <Tag>{keyword.name}</Tag>
                  </a>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="media-overview-right">
          <div className="media-facts">
            <div className="media-ratings">
              {!!data.voteCount && (
                <Tooltip
                  content={intl.formatMessage(messages.hardcoveruserscore)}
                >
                  <a
                    href={data.url}
                    className="media-rating"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <HardcoverLogo className="mr-1 w-16" />
                    <span>{Math.round(data.voteAverage * 2 * 10)}%</span>
                  </a>
                </Tooltip>
              )}
            </div>
            {data.originalTitle && data.language !== locale.slice(0, 2) && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.originaltitle)}</span>
                <span className="media-fact-value">{data.originalTitle}</span>
              </div>
            )}
            {data.language && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.originallanguage)}</span>
                <span className="media-fact-value">
                  <Link href={`/discover/books/language/${data.languageCode}`}>
                    <a>
                      {intl.formatDisplayName(data.languageCode, {
                        type: 'language',
                        fallback: 'none',
                      }) ?? data.language}
                    </a>
                  </Link>
                </span>
              </div>
            )}
            <div className="media-fact">
              <span>{intl.formatMessage(globalMessages.status)}</span>
              <span className="media-fact-value">{data.status}</span>
            </div>
            {data.releaseDate && (
              <div className="media-fact">
                <span>
                  {intl.formatMessage(messages.releasedate, {
                    releaseCount: 1,
                  })}
                </span>
                <span className="media-fact-value">
                  {intl.formatDate(data.releaseDate, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}
                </span>
              </div>
            )}
            {data.publisher && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.publisher)}</span>
                <span className="media-fact-value">
                  <Link
                    href={`/discover/books/publisher/${data.publisher.id}`}
                    key={`publisher-${data.publisher.id}`}
                  >
                    <a className="block">{data.publisher.name}</a>
                  </Link>
                </span>
              </div>
            )}
            <div className="media-fact">
              <ExternalLinkBlock mediaType="book" hardcoverUrl={data.url} />
            </div>
          </div>
        </div>
      </div>
      {data.series && (
        <MediaSlider
          sliderKey="series"
          title={intl.formatMessage(messages.series, {
            name: data.series.name,
            seriesPosition: data.series.position,
          })}
          url={`/api/v1/book/${router.query.bookId}/series`}
          linkUrl={`/book/${data.id}/series`}
          hideWhenEmpty
        />
      )}
      <MediaSlider
        sliderKey="similar"
        title={intl.formatMessage(messages.similar)}
        url={`/api/v1/book/${router.query.bookId}/similar`}
        linkUrl={`/book/${data.id}/similar`}
        hideWhenEmpty
      />
      <div className="extra-bottom-space relative" />
    </div>
  );
};

export default BookDetails;
