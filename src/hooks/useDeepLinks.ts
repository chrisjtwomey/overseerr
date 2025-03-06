import { useEffect, useState } from 'react';

interface useDeepLinksProps {
  plexUrl?: string;
  plexUrl4k?: string;
  iOSPlexUrl?: string;
  iOSPlexUrl4k?: string;
  calibreWebUrl?: string;
}

const useDeepLinks = ({
  plexUrl,
  plexUrl4k,
  iOSPlexUrl,
  iOSPlexUrl4k,
  calibreWebUrl,
}: useDeepLinksProps) => {
  const [returnedPlexUrl, setReturnedPlexUrl] = useState(plexUrl);
  const [returnedPlexUrl4k, setReturnedPlexUrl4k] = useState(plexUrl4k);
  const [returnedCalibreWebUrl, setReturnedCalibreWebUrl] =
    useState(calibreWebUrl);

  useEffect(() => {
    if (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1)
    ) {
      setReturnedPlexUrl(iOSPlexUrl);
      setReturnedPlexUrl4k(iOSPlexUrl4k);
    } else {
      setReturnedPlexUrl(plexUrl);
      setReturnedPlexUrl4k(plexUrl4k);
    }

    setReturnedCalibreWebUrl(calibreWebUrl);
  }, [iOSPlexUrl, iOSPlexUrl4k, plexUrl, plexUrl4k, calibreWebUrl]);

  return {
    plexUrl: returnedPlexUrl,
    plexUrl4k: returnedPlexUrl4k,
    calibreWebUrl: returnedCalibreWebUrl,
  };
};

export default useDeepLinks;
