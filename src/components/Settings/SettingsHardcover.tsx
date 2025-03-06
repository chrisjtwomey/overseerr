import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import globalMessages from '@app/i18n/globalMessages';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import type { HardcoverSettings } from '@server/lib/settings';
import axios from 'axios';
import { Formik } from 'formik';
import Link from 'next/link';
import { defineMessages, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages({
  hardcover: 'Hardcover',
  hardcoversettings: 'Hardcover Settings',
  hardcoversettingsDescription:
    'Hardcover is the metadata provider for books on Overseerr. An API key is required in order for Overseerr to function. See the <HardcoverLink>getting started guide</HardcoverLink> for more information.',
  toastHardcoverConnecting: 'Attempting to connect to Hardcover...',
  toastHardcoverConnectingSuccess:
    'Hardcover connection established successfully!',
  toastHardcoverConnectingFailure: 'Failed to connect to Hardcover.',
  toastHardcoverSettingsSuccess: 'Hardcover settings saved successfully!',
  toastHardcoverSettingsFailure: 'Failed to save Hardcover settings.',
  token: 'Token',
  apiKey: 'API Key',
  validationApiKey: 'You must provide an API key',
});

interface SettingsHardcoverProps {
  onComplete?: () => void;
}

const SettingsHardcover = ({ onComplete }: SettingsHardcoverProps) => {
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<HardcoverSettings>('/api/v1/settings/hardcover');
  const intl = useIntl();
  const { addToast, removeToast } = useToasts();

  const HardcoverSettingsSchema = Yup.object().shape({
    token: Yup.string().required(),
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }
  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.hardcover),
          intl.formatMessage(globalMessages.settings),
        ]}
      />
      <div className="mb-6">
        <h3 className="heading">
          {intl.formatMessage(messages.hardcoversettings)}
        </h3>
        <p className="description">
          {intl.formatMessage(messages.hardcoversettingsDescription, {
            HardcoverLink: (msg: React.ReactNode) => (
              <Link href="https://docs.hardcover.app/api/getting-started/#getting-an-api-key">
                <a className="text-white transition duration-300 hover:underline">
                  {msg}
                </a>
              </Link>
            ),
          })}
        </p>
      </div>
      <Formik
        initialValues={{
          token: data?.token,
        }}
        validationSchema={HardcoverSettingsSchema}
        onSubmit={async (values) => {
          let toastId: string | null = null;
          try {
            addToast(
              intl.formatMessage(messages.toastHardcoverConnecting),
              {
                autoDismiss: false,
                appearance: 'info',
              },
              (id) => {
                toastId = id;
              }
            );

            await axios.post('/api/v1/settings/hardcover', {
              token: values.token,
            } as HardcoverSettings);

            if (toastId) {
              removeToast(toastId);
            }
            addToast(
              intl.formatMessage(messages.toastHardcoverConnectingSuccess),
              {
                autoDismiss: true,
                appearance: 'success',
              }
            );

            if (onComplete) {
              onComplete();
            }
          } catch (e) {
            if (toastId) {
              removeToast(toastId);
            }

            addToast(
              intl.formatMessage(messages.toastHardcoverConnectingFailure),
              {
                autoDismiss: true,
                appearance: 'error',
              }
            );
          } finally {
            revalidate();
          }
        }}
      >
        {({
          errors,
          touched,
          handleSubmit,
          setFieldValue,
          isSubmitting,
          isValid,
        }) => {
          return (
            <form className="section" onSubmit={handleSubmit}>
              <div className="form-row">
                <label htmlFor="token" className="text-label">
                  {intl.formatMessage(messages.token)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <SensitiveInput
                      as="field"
                      id="token"
                      name="token"
                      autoComplete="one-time-code"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setFieldValue('token', e.target.value);
                      }}
                    />
                  </div>
                  {errors.token &&
                    touched.token &&
                    typeof errors.token === 'string' && (
                      <div className="error">{errors.token}</div>
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

export default SettingsHardcover;
