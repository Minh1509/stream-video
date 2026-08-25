import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import { issueStreamToken } from '../../apis/video.api';
import type { Video } from '../../types/video.type';

interface Props {
  video: Video | null;
  onClose: () => void;
}

interface Quality {
  height: number; // e.g. 720
  index: number; // hls.js level index
}

export default function VideoPlayerModal({ video, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  // -1 = Auto (adaptive); otherwise a specific hls.js level index.
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!video) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [video, onClose]);

  // Attach the HLS stream. hls.js handles adaptive 360p/720p/1080p switching on
  // browsers without native HLS; Safari plays the .m3u8 directly (no selector).
  useEffect(() => {
    const el = videoRef.current;
    const src = video?.hlsMasterUrl;
    const videoId = video?.id;
    if (!el || !src || !videoId) return;

    setCurrentLevel(-1);
    setQualities([]);

    if (!Hls.isSupported()) {
      // Safari — native HLS with no xhrSetup support; token auth not applied
      el.src = src;
      return;
    }

    let destroyed = false;
    let hls: Hls | null = null;

    issueStreamToken(videoId)
      .then(({ token }) => {
        if (destroyed) return;

        hls = new Hls({
          xhrSetup(xhr, url) {
            // Attach the JWT only to the key endpoint requests
            if (url.includes('/stream/key')) {
              const separator = url.includes('?') ? '&' : '?';
              xhr.open('GET', `${url}${separator}token=${token}`, true);
            }
          },
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(el);
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          setQualities(data.levels.map((lvl, index) => ({ height: lvl.height, index })));
        });
      })
      .catch(() => {
        // Fallback: load without token (key endpoint will reject, video won't decrypt)
        if (destroyed) return;
        hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(el);
      });

    return () => {
      destroyed = true;
      hls?.destroy();
      hlsRef.current = null;
    };
  }, [video]);

  const changeQuality = (level: number) => {
    setCurrentLevel(level);
    setMenuOpen(false);
    if (hlsRef.current) hlsRef.current.currentLevel = level;
  };

  const currentLabel =
    currentLevel === -1
      ? 'Auto'
      : `${qualities.find((q) => q.index === currentLevel)?.height ?? ''}p`;

  // Fullscreen the whole stage (video + overlay) so the quality button stays
  // visible. The native fullscreen button only expands the bare <video>.
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void stageRef.current?.requestFullscreen();
    }
  };

  if (!video) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-5 w-5"
          >
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>

        <div ref={stageRef} className="relative aspect-video w-full bg-black">
          <video
            ref={videoRef}
            poster={video.thumbnailUrl}
            controls
            autoPlay
            controlsList="nofullscreen"
            className="h-full w-full"
          >
            Trình duyệt của bạn không hỗ trợ thẻ video.
          </video>

          {qualities.length > 1 && (
            <div className="absolute left-3 top-3 z-10">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Chọn chất lượng"
                aria-expanded={menuOpen}
                className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-4 w-4"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path
                    d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {currentLabel}
              </button>

              {menuOpen && (
                <div className="absolute left-0 top-11 min-w-[120px] overflow-hidden rounded-xl bg-black/85 py-1 text-sm text-white shadow-xl backdrop-blur">
                  <QualityOption
                    label="Auto"
                    active={currentLevel === -1}
                    onClick={() => changeQuality(-1)}
                  />
                  {qualities.map((q) => (
                    <QualityOption
                      key={q.index}
                      label={`${q.height}p`}
                      active={currentLevel === q.index}
                      onClick={() => changeQuality(q.index)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Toàn màn hình"
            className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5"
            >
              <path
                d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <h2 className="text-lg font-bold text-slate-900">{video.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{video.description}</p>
        </div>
      </div>
    </div>
  );
}

function QualityOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition hover:bg-white/15 ${
        active ? 'font-semibold text-indigo-300' : 'text-white'
      }`}
    >
      {label}
      {active && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          className="h-4 w-4"
        >
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
