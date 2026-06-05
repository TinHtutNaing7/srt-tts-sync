/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:       '#0c0c0e',
        surface:  '#141416',
        panel:    '#1a1a1d',
        border:   '#252528',
        amber:    '#f0a830',
        amberDim: '#a0700f',
        teal:     '#14b8a6',
        muted:    '#55555a',
        text:     '#e8e8e2',
        textDim:  '#88888e',
      },
      fontFamily: {
        display: ['var(--font-bebas)', 'sans-serif'],
        body:    ['var(--font-dm-sans)', 'sans-serif'],
        mono:    ['var(--font-jetbrains)', 'monospace'],
      },
    },
  },
  plugins: [],
};
