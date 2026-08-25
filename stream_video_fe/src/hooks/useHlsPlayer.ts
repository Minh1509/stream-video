import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import { issueStreamToken } from '../apis/video.api';
import type { Video } from '../types/video.type';

export interface Quality {
  height: number;
  index: number;
}

export interface HlsPlayerState {
  qualities: Quality[];
  currentLevel: number;
  playerError: string | null;
  changeQuality: (level: number) => void;
}

export function useHlsPlayer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  video: Video | null
): HlsPlayerState {
  const hlsRef = useRef<Hls | null>(null);
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [playerError, setPlayerError] = useState<string | null>(null);

  useEffect(() => {
    setPlayerError(null);
    setCurrentLevel(-1);
    setQualities([]);

    const el = videoRef.current;
    const src = video?.hlsMasterUrl;
    const videoId = video?.id;
    if (!el || !src || !videoId) return;

    if (!Hls.isSupported()) {
      // Safari plays .m3u8 natively — AES-128 decryption handled by the browser
      el.src = src;
      return;
    }

    const ac = new AbortController();

    issueStreamToken(videoId, ac.signal)
      .then(({ token }) => {
        if (ac.signal.aborted) return;

        const hls = new Hls({
          xhrSetup(xhr, url) {
            if (url.includes('/stream/key')) {
              const sep = url.includes('?') ? '&' : '?';
              xhr.open('GET', `${url}${sep}token=${token}`, true);
            }
          },
        });

        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(el);
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          setQualities(data.levels.map((lvl, index) => ({ height: lvl.height, index })));
        });

        hls.on(Hls.Events.ERROR, (_e, data) => {
          console.error('[HLS Error]:', data);

          const isError =
            data.fatal ||
            data.details === Hls.ErrorDetails.KEY_LOAD_ERROR ||
            data.details === Hls.ErrorDetails.FRAG_PARSING_ERROR ||
            data.type === Hls.ErrorTypes.MEDIA_ERROR ||
            data.response?.code === 401 ||
            data.response?.code === 403;

          if (isError) {
            setPlayerError('Không thể phát video này. Vui lòng thử lại.');
            hls.destroy();
          }
        });
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setPlayerError('Không thể tải video. Vui lòng thử lại.');
      });

    return () => {
      ac.abort();
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [video, videoRef]);

  const changeQuality = (level: number) => {
    setCurrentLevel(level);
    if (hlsRef.current) hlsRef.current.currentLevel = level;
  };

  return { qualities, currentLevel, playerError, changeQuality };
}
