import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        text: 'var(--text)',
        background: 'var(--background)',
        surface: 'var(--surface)',
        primary: 'var(--primary)',
        secondary: 'var(--secondary)',
        accent: 'var(--accent)',
        buttonText: 'var(--button-text)',
        buttonTextDark: 'var(--button-text-dark)',
        surfaceHover: 'var(--surface-hover)',
        primaryHover: 'var(--primary-hover)',
        secondaryHover: 'var(--secondary-hover)',
        accentHover: 'var(--accent-hover)',
      },
    },
  },
  plugins: [],
};

export default config;