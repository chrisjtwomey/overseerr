import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import globalMessages from '@app/i18n/globalMessages';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/solid';
import type {
  CalibreWebDownloaderSettings,
  CalibreWebSettings,
} from '@server/lib/settings';
import axios from 'axios';
import { Field, Formik } from 'formik';
import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages({
  calibreWeb: 'Calibre Web',
  calibreWebSettings: 'Calibre Settings',
  calibreWebSettingsDescription:
    'Configure the settings for your Calibre Web server. Overseerr scans your Calibre Web library to determine content availability.',
  hostname: 'Hostname or IP Address',
  port: 'Port',
  enablessl: 'Use SSL',
  scanning: 'Syncing…',
  scan: 'Sync Libraries',
  manualscan: 'Manual Library Scan',
  manualcalibrewebscanDescription:
    "Normally, this will only be run once every 24 hours. Overseerr will check your Calibre Web server's recently added more aggressively. If this is your first time configuring Calibre Web, a one-time full manual library scan is recommended!",
  notrunning: 'Not Running',
  scanningLibrary: 'Scanning Library...',
  librariesRemaining: 'Libraries Remaining: {count}',
  startscan: 'Start Scan',
  cancelscan: 'Cancel Scan',
  token: 'Token',
  calibrelibrary: 'Calibre Web Library',
  calibrelibrarydescription:
    'Select the libraries you want to sync with Overseerr.',
  toastCalibreWebConnecting: 'Attempting to connect to Calibre Web...',
  toastCalibreWebConnectingSuccess:
    'Calibre Web connection established successfully!',
  toastCalibreWebConnectingFailure: 'Failed to connect to Calibre Web.',
  toastCalibreWebDownloaderSettingsSuccess:
    'Calibre Web Downloader settings saved successfully!',
  toastCalibreWebDownloaderSettingsFailure:
    'Failed to save Calibre Web Downloader settings.',
  validationHostnameRequired: 'You must provide a valid hostname or IP address',
  validationPortRequired: 'You must provide a valid port number',
  urlBase: 'URL Base',
  apiKey: 'API Key',
  calibreWebDownloaderSettings: 'Calibre Web Downloader Settings',
  calibreWebDownloaderSettingsDescription:
    'Configure the settings for your Calibre Web Downloader server. Overseerr uses this to download books to Calibre Web.',

  externalUrl: 'External URL',
  validationApiKey: 'You must provide an API key',
  validationUrl: 'You must provide a valid URL',
  validationUrlTrailingSlash: 'URL must not end in a trailing slash',
  validationUrlBaseLeadingSlash: 'URL base must have a leading slash',
  validationUrlBaseTrailingSlash: 'URL base must not end in a trailing slash',
});

interface SyncStatus {
  running: boolean;
  progress: number;
  total: number;
}

interface SettingsCalibreWebProps {
  onCalibreWebComplete?: () => void;
  onCalibreWebDownloaderComplete?: () => void;
}

const SettingsCalibreWeb = ({
  onCalibreWebComplete,
  onCalibreWebDownloaderComplete,
}: SettingsCalibreWebProps) => {
  const [isSyncing] = useState(false);
  const { data, error } = useSWR<CalibreWebSettings>(
    '/api/v1/settings/calibreweb'
  );
  const {
    data: dataCalibreWebDownloader,
    mutate: revalidateCalibreWebDownloader,
  } = useSWR<CalibreWebDownloaderSettings>(
    '/api/v1/settings/calibreweb/downloader'
  );
  const { data: dataSync, mutate: revalidateSync } = useSWR<SyncStatus>(
    '/api/v1/settings/calibreweb/sync',
    {
      refreshInterval: 1000,
    }
  );
  const intl = useIntl();
  const { addToast, removeToast } = useToasts();

  const CalibreWebSettingsSchema = Yup.object().shape(
    {
      hostname: Yup.string()
        .when(['calibreWebPort', 'calibreWebApiKey'], {
          is: (value: unknown) => !!value,
          then: Yup.string()
            .nullable()
            .required(intl.formatMessage(messages.validationHostnameRequired)),
          otherwise: Yup.string().nullable(),
        })
        .matches(
          /^(([a-z]|\d|_|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*)?([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])$/i,
          intl.formatMessage(messages.validationHostnameRequired)
        ),
      port: Yup.number().when(['calibreWebHostname', 'calibreWebApiKey'], {
        is: (value: unknown) => !!value,
        then: Yup.number()
          .typeError(intl.formatMessage(messages.validationPortRequired))
          .nullable()
          .required(intl.formatMessage(messages.validationPortRequired)),
        otherwise: Yup.number()
          .typeError(intl.formatMessage(messages.validationPortRequired))
          .nullable(),
      }),
      urlBase: Yup.string()
        .test(
          'leading-slash',
          intl.formatMessage(messages.validationUrlBaseLeadingSlash),
          (value) => !value || value.startsWith('/')
        )
        .test(
          'no-trailing-slash',
          intl.formatMessage(messages.validationUrlBaseTrailingSlash),
          (value) => !value || !value.endsWith('/')
        ),
      apiKey: Yup.string().when(['calibreWebHostname', 'calibreWebPort'], {
        is: (value: unknown) => !!value,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.validationApiKey)),
        otherwise: Yup.string().nullable(),
      }),
      externalUrl: Yup.string()
        .url(intl.formatMessage(messages.validationUrl))
        .test(
          'no-trailing-slash',
          intl.formatMessage(messages.validationUrlTrailingSlash),
          (value) => !value || !value.endsWith('/')
        ),
    },
    [
      ['calibreWebHostname', 'calibreWebPort'],
      ['calibreWebHostname', 'calibreWebApiKey'],
      ['calibreWebPort', 'calibreWebApiKey'],
    ]
  );

  const CalibreWebDownloaderSettingsSchema = Yup.object().shape(
    {
      calibreWebDownloaderHostname: Yup.string()
        .when(['calibreWebDownloaderPort'], {
          is: (value: unknown) => !!value,
          then: Yup.string()
            .nullable()
            .required(intl.formatMessage(messages.validationHostnameRequired)),
          otherwise: Yup.string().nullable(),
        })
        .matches(
          /^(([a-z]|\d|_|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*)?([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])$/i,
          intl.formatMessage(messages.validationHostnameRequired)
        ),
      calibreWebDownloaderPort: Yup.number().when(
        ['calibreWebDownloaderHostname'],
        {
          is: (value: unknown) => !!value,
          then: Yup.number()
            .typeError(intl.formatMessage(messages.validationPortRequired))
            .nullable()
            .required(intl.formatMessage(messages.validationPortRequired)),
          otherwise: Yup.number()
            .typeError(intl.formatMessage(messages.validationPortRequired))
            .nullable(),
        }
      ),
      calibreWebDownloaderUrlBase: Yup.string()
        .test(
          'leading-slash',
          intl.formatMessage(messages.validationUrlBaseLeadingSlash),
          (value) => !value || value.startsWith('/')
        )
        .test(
          'no-trailing-slash',
          intl.formatMessage(messages.validationUrlBaseTrailingSlash),
          (value) => !value || !value.endsWith('/')
        ),
      calibreWebDownloaderExternalUrl: Yup.string()
        .url(intl.formatMessage(messages.validationUrl))
        .test(
          'no-trailing-slash',
          intl.formatMessage(messages.validationUrlTrailingSlash),
          (value) => !value || !value.endsWith('/')
        ),
    },
    [['calibreWebDownloaderHostname', 'calibreWebDownloaderPort']]
  );

  const startScan = async () => {
    await axios.post('/api/v1/settings/calibreweb/sync', {
      start: true,
    });
    revalidateSync();
  };

  const cancelScan = async () => {
    await axios.post('/api/v1/settings/calibreweb/sync', {
      cancel: true,
    });
    revalidateSync();
  };

  if ((!data || !dataCalibreWebDownloader) && !error) {
    return <LoadingSpinner />;
  }
  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.calibreWeb),
          intl.formatMessage(globalMessages.settings),
        ]}
      />
      <div className="mb-6">
        <h3 className="heading">
          {intl.formatMessage(messages.calibreWebSettings)}
        </h3>
        <p className="description">
          {intl.formatMessage(messages.calibreWebSettingsDescription)}
        </p>
      </div>
      <Formik
        initialValues={{
          hostname: data?.hostname,
          port: data?.port ?? 8086,
          useSsl: data?.useSsl,
          apiKey: data?.apiKey,
        }}
        validationSchema={CalibreWebSettingsSchema}
        onSubmit={async (values) => {
          let toastId: string | null = null;
          try {
            addToast(
              intl.formatMessage(messages.toastCalibreWebConnecting),
              {
                autoDismiss: false,
                appearance: 'info',
              },
              (id) => {
                toastId = id;
              }
            );
            await axios.post('/api/v1/settings/calibreweb', {
              hostname: values.hostname,
              port: Number(values.port),
              useSsl: values.useSsl,
              apiKey: values.apiKey,
            } as CalibreWebSettings);

            if (toastId) {
              removeToast(toastId);
            }
            addToast(
              intl.formatMessage(messages.toastCalibreWebConnectingSuccess),
              {
                autoDismiss: true,
                appearance: 'success',
              }
            );

            if (onCalibreWebComplete) {
              onCalibreWebComplete();
            }
          } catch (e) {
            if (toastId) {
              removeToast(toastId);
            }
            addToast(
              intl.formatMessage(messages.toastCalibreWebConnectingFailure),
              {
                autoDismiss: true,
                appearance: 'error',
              }
            );
          }
        }}
      >
        {({
          errors,
          touched,
          values,
          handleSubmit,
          setFieldValue,
          isSubmitting,
          isValid,
        }) => {
          return (
            <form className="section" onSubmit={handleSubmit}>
              <div className="form-row">
                <label htmlFor="hostname" className="text-label">
                  {intl.formatMessage(messages.hostname)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-gray-100 sm:text-sm">
                      {values.useSsl ? 'https://' : 'http://'}
                    </span>
                    <Field
                      type="text"
                      inputMode="url"
                      id="hostname"
                      name="hostname"
                      className="rounded-r-only"
                    />
                  </div>
                  {errors.hostname &&
                    touched.hostname &&
                    typeof errors.hostname === 'string' && (
                      <div className="error">{errors.hostname}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="port" className="text-label">
                  {intl.formatMessage(messages.port)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <Field
                    type="text"
                    inputMode="numeric"
                    id="port"
                    name="port"
                    className="short"
                  />
                  {errors.port &&
                    touched.port &&
                    typeof errors.port === 'string' && (
                      <div className="error">{errors.port}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="ssl" className="checkbox-label">
                  {intl.formatMessage(messages.enablessl)}
                </label>
                <div className="form-input-area">
                  <Field
                    type="checkbox"
                    id="useSsl"
                    name="useSsl"
                    onChange={() => {
                      setFieldValue('useSsl', !values.useSsl);
                    }}
                  />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="apiKey" className="text-label">
                  {intl.formatMessage(messages.apiKey)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <SensitiveInput
                      as="field"
                      id="apiKey"
                      name="apiKey"
                      autoComplete="one-time-code"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setFieldValue('apiKey', e.target.value);
                      }}
                    />
                  </div>
                  {errors.apiKey &&
                    touched.apiKey &&
                    typeof errors.apiKey === 'string' && (
                      <div className="error">{errors.apiKey}</div>
                    )}
                </div>
              </div>
              <div className="actions">
                <div className="flex justify-end">
                  <span className="ml-3 inline-flex rounded-md shadow-sm">
                    <Button
                      buttonType="primary"
                      type="submit"
                      disabled={isSubmitting || !isValid}
                    >
                      <ArrowDownOnSquareIcon />
                      <span>
                        {isSubmitting
                          ? intl.formatMessage(globalMessages.saving)
                          : intl.formatMessage(globalMessages.save)}
                      </span>
                    </Button>
                  </span>
                </div>
              </div>
            </form>
          );
        }}
      </Formik>
      <div className="mt-10 mb-6">
        <h3 className="heading">{intl.formatMessage(messages.manualscan)}</h3>
        <p className="description">
          {intl.formatMessage(messages.manualcalibrewebscanDescription)}
        </p>
      </div>
      <div className="section">
        <div className="rounded-md bg-gray-800 p-4">
          <div className="relative mb-6 h-8 w-full overflow-hidden rounded-full bg-gray-600">
            {dataSync?.running && (
              <div
                className="h-8 bg-indigo-600 transition-all duration-200 ease-in-out"
                style={{
                  width: `${Math.round(
                    (dataSync.progress / dataSync.total) * 100
                  )}%`,
                }}
              />
            )}
            <div className="absolute inset-0 flex h-8 w-full items-center justify-center text-sm">
              <span>
                {dataSync?.running
                  ? `${dataSync.progress} of ${dataSync.total}`
                  : 'Not running'}
              </span>
            </div>
          </div>
          <div className="flex w-full flex-col sm:flex-row">
            {dataSync?.running && (
              <>
                <div className="mb-2 mr-0 flex items-center sm:mb-0 sm:mr-2">
                  <Badge>{intl.formatMessage(messages.scanningLibrary)}</Badge>
                </div>
                <div className="flex items-center">
                  <Badge badgeType="warning">
                    {intl.formatMessage(messages.librariesRemaining, {
                      count: 1,
                    })}
                  </Badge>
                </div>
              </>
            )}
            <div className="flex-1 text-right">
              {!dataSync?.running ? (
                <Button
                  buttonType="warning"
                  onClick={() => startScan()}
                  disabled={isSyncing}
                >
                  <MagnifyingGlassIcon />
                  <span>{intl.formatMessage(messages.startscan)}</span>
                </Button>
              ) : (
                <Button buttonType="danger" onClick={() => cancelScan()}>
                  <XMarkIcon />
                  <span>{intl.formatMessage(messages.cancelscan)}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-10 mb-6">
        <h3 className="heading">
          {intl.formatMessage(messages.calibreWebDownloaderSettings)}
        </h3>
        <p className="description">
          {intl.formatMessage(messages.calibreWebDownloaderSettingsDescription)}
        </p>
      </div>
      <Formik
        initialValues={{
          calibreWebDownloaderHostname: dataCalibreWebDownloader?.hostname,
          calibreWebDownloaderPort: dataCalibreWebDownloader?.port ?? 8085,
          calibreWebDownloaderUseSsl: dataCalibreWebDownloader?.useSsl,
          calibreWebDownloaderUrlBase: dataCalibreWebDownloader?.urlBase,
          calibreWebDownloaderExternalUrl:
            dataCalibreWebDownloader?.externalUrl,
        }}
        validationSchema={CalibreWebDownloaderSettingsSchema}
        onSubmit={async (values) => {
          try {
            await axios.post('/api/v1/settings/calibreweb/downloader', {
              hostname: values.calibreWebDownloaderHostname,
              port: Number(values.calibreWebDownloaderPort),
              useSsl: values.calibreWebDownloaderUseSsl,
              urlBase: values.calibreWebDownloaderUrlBase,
              externalUrl: values.calibreWebDownloaderExternalUrl,
            } as CalibreWebDownloaderSettings);

            addToast(
              intl.formatMessage(
                messages.toastCalibreWebDownloaderSettingsSuccess
              ),
              {
                autoDismiss: true,
                appearance: 'success',
              }
            );

            if (onCalibreWebDownloaderComplete) {
              onCalibreWebDownloaderComplete();
            }
          } catch (e) {
            addToast(
              intl.formatMessage(
                messages.toastCalibreWebDownloaderSettingsFailure
              ),
              {
                autoDismiss: true,
                appearance: 'error',
              }
            );
          } finally {
            revalidateCalibreWebDownloader();
          }
        }}
      >
        {({
          errors,
          touched,
          values,
          handleSubmit,
          setFieldValue,
          isSubmitting,
          isValid,
        }) => {
          return (
            <form className="section" onSubmit={handleSubmit}>
              <div className="form-row">
                <label
                  htmlFor="calibreWebDownloaderHostname"
                  className="text-label"
                >
                  {intl.formatMessage(messages.hostname)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-gray-100 sm:text-sm">
                      {values.calibreWebDownloaderUseSsl
                        ? 'https://'
                        : 'http://'}
                    </span>
                    <Field
                      type="text"
                      inputMode="url"
                      id="calibreWebDownloaderHostname"
                      name="calibreWebDownloaderHostname"
                      className="rounded-r-only"
                    />
                  </div>
                  {errors.calibreWebDownloaderHostname &&
                    touched.calibreWebDownloaderHostname &&
                    typeof errors.calibreWebDownloaderHostname === 'string' && (
                      <div className="error">
                        {errors.calibreWebDownloaderHostname}
                      </div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label
                  htmlFor="calibreWebDownloaderPort"
                  className="text-label"
                >
                  {intl.formatMessage(messages.port)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <Field
                    type="text"
                    inputMode="numeric"
                    id="calibreWebDownloaderPort"
                    name="calibreWebDownloaderPort"
                    className="short"
                  />
                  {errors.calibreWebDownloaderPort &&
                    touched.calibreWebDownloaderPort &&
                    typeof errors.calibreWebDownloaderPort === 'string' && (
                      <div className="error">
                        {errors.calibreWebDownloaderPort}
                      </div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label
                  htmlFor="calibreWebDownloaderUseSsl"
                  className="checkbox-label"
                >
                  {intl.formatMessage(messages.enablessl)}
                </label>
                <div className="form-input-area">
                  <Field
                    type="checkbox"
                    id="calibreWebDownloaderUseSsl"
                    name="calibreWebDownloaderUseSsl"
                    onChange={() => {
                      setFieldValue(
                        'calibreWebDownloaderUseSsl',
                        !values.calibreWebDownloaderUseSsl
                      );
                    }}
                  />
                </div>
              </div>
              <div className="form-row">
                <label
                  htmlFor="calibreWebDownloaderUrlBase"
                  className="text-label"
                >
                  {intl.formatMessage(messages.urlBase)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      type="text"
                      inputMode="url"
                      id="calibreWebDownloaderUrlBase"
                      name="calibreWebDownloaderUrlBase"
                    />
                  </div>
                  {errors.calibreWebDownloaderUrlBase &&
                    touched.calibreWebDownloaderUrlBase &&
                    typeof errors.calibreWebDownloaderUrlBase === 'string' && (
                      <div className="error">
                        {errors.calibreWebDownloaderUrlBase}
                      </div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label
                  htmlFor="calibreWebDownloaderExternalUrl"
                  className="text-label"
                >
                  {intl.formatMessage(messages.externalUrl)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      type="text"
                      inputMode="url"
                      id="calibreWebDownloaderExternalUrl"
                      name="calibreWebDownloaderExternalUrl"
                    />
                  </div>
                  {errors.calibreWebDownloaderExternalUrl &&
                    touched.calibreWebDownloaderExternalUrl && (
                      <div className="error">
                        {errors.calibreWebDownloaderExternalUrl}
                      </div>
                    )}
                </div>
              </div>
              <div className="actions">
                <div className="flex justify-end">
                  <span className="ml-3 inline-flex rounded-md shadow-sm">
                    <Button
                      buttonType="primary"
                      type="submit"
                      disabled={isSubmitting || !isValid}
                    >
                      <ArrowDownOnSquareIcon />
                      <span>
                        {isSubmitting
                          ? intl.formatMessage(globalMessages.saving)
                          : intl.formatMessage(globalMessages.save)}
                      </span>
                    </Button>
                  </span>
                </div>
              </div>
            </form>
          );
        }}
      </Formik>
    </>
  );
};

export default SettingsCalibreWeb;
