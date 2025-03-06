import TitleCard from '@app/components/TitleCard';
import { Permission, useUser } from '@app/hooks/useUser';
import type { BookDetails } from '@server/models/Book';
import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';
import { useInView } from 'react-intersection-observer';
import useSWR from 'swr';

export interface MediaTitleCardProps {
  id: number;
  tmdbId: number;
  tvdbId?: number;
  hardcoverId?: number;
  type: 'movie' | 'tv' | 'book';
  canExpand?: boolean;
}

const MediaTitleCard = ({
  id,
  tmdbId,
  tvdbId,
  hardcoverId,
  type,
  canExpand,
}: MediaTitleCardProps) => {
  const { hasPermission } = useUser();

  const { ref, inView } = useInView({
    triggerOnce: true,
  });
  const url =
    type === 'movie'
      ? `/api/v1/movie/${tmdbId}`
      : type === 'tv'
      ? `/api/v1/tv/${tmdbId}`
      : `/api/v1/book/${hardcoverId}`;

  const { data: title, error } = useSWR<MovieDetails | TvDetails | BookDetails>(
    inView ? `${url}` : null
  );

  if (!title && !error) {
    return (
      <div ref={ref}>
        <TitleCard.Placeholder canExpand={canExpand} />
      </div>
    );
  }

  if (!title) {
    return hasPermission(Permission.ADMIN) ? (
      <TitleCard.ErrorCard
        id={id}
        tmdbId={tmdbId}
        tvdbId={tvdbId}
        hardcoverId={hardcoverId}
        type={type}
      />
    ) : null;
  }

  return title.type === 'movie' ? (
    <TitleCard
      id={title.id}
      image={title.posterPath}
      status={title.mediaInfo?.status}
      summary={title.overview}
      title={title.title}
      userScore={title.voteAverage}
      year={title.releaseDate}
      mediaType={'movie'}
      canExpand={canExpand}
    />
  ) : title.type === 'tv' ? (
    <TitleCard
      id={title.id}
      image={title.posterPath}
      status={title.mediaInfo?.status}
      summary={title.overview}
      title={title.name}
      userScore={title.voteAverage}
      year={title.firstAirDate}
      mediaType={'tv'}
      canExpand={canExpand}
    />
  ) : (
    <TitleCard
      id={title.id}
      image={title.posterPath}
      status={title.mediaInfo?.status}
      summary={title.overview}
      title={title.title}
      userScore={title.voteAverage}
      year={title.releaseDate}
      mediaType={'book'}
      canExpand={canExpand}
    />
  );
};

export default MediaTitleCard;
