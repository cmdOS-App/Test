import baseConfig from '@extension/tailwindcss-config';
import { withUI } from '@extension/ui';
import typography from '@tailwindcss/typography';

export default withUI({
  ...baseConfig,
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  plugins: [...(baseConfig.plugins || []), typography],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        overlayBg: 'var(--color-overlayBg)',
      },
      keyframes: {
        shrink: {
          '0%': { transform: 'scaleX(1)' },
          '100%': { transform: 'scaleX(0)' },
        },
      },
      animation: {
        'shrink-3s': 'shrink 3s linear forwards',
      },
    },
  },
});
