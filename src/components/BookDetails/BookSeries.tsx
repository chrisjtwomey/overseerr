import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import Error from '@app/pages/_error';
import type { BookDetails } from '@server/models/Book';
import type { BookResult } from '@server/models/Search';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { defineMessages, useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages({
  series: 'Books in this Series',
});

const BookSeries = () => {
  const router = useRouter();
  const intl = useIntl();
  const { data: seriesData } = useSWR<BookDetails>(
    `/api/v1/book/${router.query.bookId}`
  );
  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
  } = useDiscover<BookResult>(`/api/v1/book/${router.query.bookId}/series`);

  if (error) {
    return <Error statusCode={500} />;
  }

  return (
    <>
      <PageTitle
        title={[intl.formatMessage(messages.series), seriesData?.title]}
      />
      <div className="mt-1 mb-5">
        <Header
          subtext={
            <Link href={`/book/series/${seriesData?.id}`}>
              <a className="hover:underline">{seriesData?.title}</a>
            </Link>
          }
        >
          {intl.formatMessage(messages.series)}
        </Header>
      </div>
      <ListView
        items={titles}
        isEmpty={isEmpty}
        isLoading={
          isLoadingInitialData || (isLoadingMore && (titles?.length ?? 0) > 0)
        }
        isReachingEnd={isReachingEnd}
        onScrollBottom={fetchMore}
      />
    </>
  );
};

export default BookSeries;
