// AdvancedVideoPlayer.tsx
'use client';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FaPlay } from 'react-icons/fa';
import { FaRegPauseCircle } from 'react-icons/fa';

interface AdvancedVideoPlayerProps {
  videoSrc: string;
  isYouTube?: boolean;
  needBorder?: boolean;
  needPauseButton?: boolean;
  onEnded?: () => void;
  autoPlay?: boolean;
}

const AdvancedVideoPlayer: React.FC<AdvancedVideoPlayerProps> = ({
  videoSrc,
  isYouTube = false,
  needBorder = true,
  needPauseButton = true,
  onEnded,
  autoPlay = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper functions to detect URL types
  const isYouTubeUrl = (url: string): boolean => {
    if (!url) return false;
    return url.includes('youtube.com') || url.includes('youtu.be');
  };

  const isDriveUrl = (url: string): boolean => {
    if (!url) return false;
    return url.includes('drive.google.com');
  };

  // Auto-detect types
  const shouldUseYouTube = isYouTube || isYouTubeUrl(videoSrc);
  const shouldUseDrive = isDriveUrl(videoSrc);

  const getYouTubeEmbedUrl = (url: string): string => {
    const autoplayParam = autoPlay ? '1' : '0';
    if (url.includes('/embed/')) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}autoplay=${autoplayParam}&mute=1&enablejsapi=1`;
    }
    let videoId = '';
    if (url.includes('youtube.com/watch?v=')) {
      videoId = url.split('v=')[1].split('&')[0];
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    }
    return `https://www.youtube.com/embed/${videoId}?autoplay=${autoplayParam}&mute=1&enablejsapi=1`;
  };

  const getDriveEmbedUrl = (url: string): string => {
    let embedUrl = url;
    if (url.includes('/view')) {
      embedUrl = url.replace('/view', '/preview');
    }
    // Add autoplay and mute parameter
    const autoplayParam = autoPlay ? '1' : '0';
    const separator = embedUrl.includes('?') ? '&' : '?';
    return `${embedUrl}${separator}autoplay=${autoplayParam}&mute=1`;
  };

  // For Drive videos, we might want to try a direct link if possible for onEnded support
  // But reliable direct links for Drive require more complex handling.
  // For now, we use preview embed.

  const togglePlayPause = () => {
    if (shouldUseYouTube || shouldUseDrive) {
      return;
    }

    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => console.error('Playback failed:', err));
      }
    }
  };

  const updateProgress = useCallback(() => {
    if (videoRef.current && !shouldUseYouTube && !shouldUseDrive) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      if (duration) {
        setProgress((current / duration) * 100);
        setCurrentTime(current);
      }
    }
  }, [shouldUseYouTube, shouldUseDrive]);

  const isInViewport = (element: HTMLElement | null): boolean => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  };

  useEffect(() => {
    if (shouldUseYouTube || shouldUseDrive) return;

    const handleScroll = () => {
      if (containerRef.current) {
        if (isInViewport(containerRef.current)) {
          if (!isPlaying && videoRef.current && autoPlay) {
            videoRef.current.currentTime = currentTime;
            videoRef.current.play().catch(err => console.error('Auto-play failed:', err));
          }
        } else {
          if (isPlaying && videoRef.current) {
            videoRef.current.pause();
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isPlaying, currentTime, shouldUseYouTube, shouldUseDrive, autoPlay]);

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }, [videoSrc]);

  useEffect(() => {
    if (shouldUseYouTube || shouldUseDrive) return undefined;

    const videoEl = videoRef.current;
    if (!videoEl) return undefined;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      if (onEnded) onEnded();
    };

    videoEl.addEventListener('timeupdate', updateProgress);
    videoEl.addEventListener('play', handlePlay);
    videoEl.addEventListener('pause', handlePause);
    videoEl.addEventListener('ended', handleEnded);

    if (autoPlay && isInViewport(containerRef.current)) {
      videoEl.play().catch(err => console.error('Initial auto-play prevented:', err));
    }

    return () => {
      videoEl.removeEventListener('timeupdate', updateProgress);
      videoEl.removeEventListener('play', handlePlay);
      videoEl.removeEventListener('pause', handlePause);
      videoEl.removeEventListener('ended', handleEnded);
    };
  }, [videoSrc, shouldUseYouTube, shouldUseDrive, updateProgress, onEnded, autoPlay]);

  const circleRadius = 18;
  const circumference = 2 * Math.PI * circleRadius;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-3xl"
      style={{
        padding: '4px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12)',
        border: needBorder ? '1px solid #3e3e3eff' : 'none',
      }}>
      <div
        className="h-full w-full overflow-hidden rounded-2xl"
        style={{
          aspectRatio: '16/9',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
        {shouldUseYouTube ? (
          <iframe
            ref={iframeRef}
            className="h-full w-full"
            src={getYouTubeEmbedUrl(videoSrc)}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : shouldUseDrive ? (
          <iframe
            className="h-full w-full"
            src={getDriveEmbedUrl(videoSrc)}
            title="Google Drive video player"
            frameBorder="0"
            allow="autoplay"
            allowFullScreen
          />
        ) : (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted={false}
            playsInline
            autoPlay={autoPlay}
            key={videoSrc}>
            <source src={videoSrc} type="video/mp4" />
            <source src={videoSrc} type="video/webm" />
            Your browser does not support the video tag.
          </video>
        )}
      </div>

      {!shouldUseYouTube && !shouldUseDrive && needPauseButton && (
        <div className="absolute bottom-4 left-4 z-10">
          <motion.div
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-black bg-opacity-50"
            initial={{ opacity: 0.8 }}
            whileHover={{ opacity: 1, scale: 1.05 }}
            transition={{ duration: 0.2 }}>
            <div className="relative h-10 w-10">
              <svg width="40" height="40">
                <circle
                  cx="20"
                  cy="20"
                  r={circleRadius}
                  fill="transparent"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2"
                />
                <motion.circle
                  cx="20"
                  cy="20"
                  r={circleRadius}
                  fill="transparent"
                  stroke="white"
                  strokeWidth="2"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress / 100)}
                  strokeLinecap="round"
                  initial={{ rotate: -90 }}
                  style={{
                    transformOrigin: 'center',
                    rotate: -90,
                  }}
                />
              </svg>
              <motion.button
                onClick={togglePlayPause}
                className="absolute inset-0 flex items-center justify-center text-white"
                aria-label={isPlaying ? 'Pause' : 'Play'}
                whileTap={{ scale: 0.9 }}>
                {isPlaying ? <FaRegPauseCircle size={16} /> : <FaPlay size={16} />}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdvancedVideoPlayer;
