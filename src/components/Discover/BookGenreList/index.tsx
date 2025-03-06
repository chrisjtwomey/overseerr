import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import GenreCard from '@app/components/GenreCard';
import Error from '@app/pages/_error';
import type { GenreSliderItem } from '@server/interfaces/api/discoverInterfaces';
import { defineMessages, useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages({
  bookgenres: 'Book Genres',
});

const BookGenreList = () => {
  const intl = useIntl();
  const { data, error } = useSWR<GenreSliderItem[]>(
    `/api/v1/discover/genreslider/book`
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <Error statusCode={404} />;
  }

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.bookgenres)} />
      <div className="mt-1 mb-5">
        <Header>{intl.formatMessage(messages.bookgenres)}</Header>
      </div>
      <ul className="cards-horizontal">
        {data.map((genre, index) => (
          <li key={`genre-${genre.id}-${index}`}>
            <GenreCard
              name={genre.name}
              image=""
              url={`/discover/books/genre/${genre.id}`}
              canExpand
            />
          </li>
        ))}
      </ul>
    </>
  );
};

export default BookGenreList;
