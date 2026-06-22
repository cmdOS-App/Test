import { useState, useEffect } from 'react';
import { CiPlay1 as Play, CiPause1 as Pause } from 'react-icons/ci';
import { motion } from 'framer-motion';

interface VideoPlaceholderProps {
  title: string;
  icon: React.ReactNode;
  darkMode?: boolean;
}

const VideoPlaceholder = ({ title, icon, darkMode = true }: VideoPlaceholderProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  // Simulated progress
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isPlaying) {
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.5;
        });
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  // Calculate circumference for the progress circle
  const circleRadius = 18;
  const circumference = 2 * Math.PI * circleRadius;

  return (
    <div className="relative w-full h-full aspect-video">
      <div
        className={`w-full h-full flex items-center justify-center ${darkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
        <div className="text-center">
          <div className="mx-auto w-20 h-20 mb-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{
                repeat: Infinity,
                repeatType: 'reverse',
                duration: 1,
              }}>
              {icon}
            </motion.div>
          </div>
          <p className={`text-lg font-medium ${darkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>{title} Demo</p>
        </div>
      </div>

      {/* Play/pause button with progress */}
      <div className="absolute bottom-4 left-4 z-10">
        <motion.div
          className={`relative h-10 w-10 rounded-full ${
            darkMode ? 'bg-neutral-800' : 'bg-black'
          } bg-opacity-50 flex items-center justify-center`}
          initial={{ opacity: 0.8 }}
          whileHover={{ opacity: 1, scale: 1.05 }}
          transition={{ duration: 0.2 }}>
          <div className="relative w-10 h-10">
            <svg width="40" height="40">
              <circle
                cx="20"
                cy="20"
                r={circleRadius}
                fill="transparent"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="2"
              />

              {/* Progress circle */}
              <motion.circle
                cx="20"
                cy="20"
                r={circleRadius}
                fill="transparent"
                stroke="rgba(209, 213, 219, 0.6)"
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
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default VideoPlaceholder;
