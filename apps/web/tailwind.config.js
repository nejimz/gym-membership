/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0c1210',
          900: '#121a17',
          800: '#1a2621',
          700: '#24332c',
        },
        moss: {
          400: '#6fbf8c',
          500: '#3d9a63',
          600: '#2f7a4e',
          700: '#245c3b',
        },
        sand: {
          50: '#f3f1ea',
          100: '#e8e4d8',
          200: '#d4ceb8',
        },
        ember: {
          500: '#c45c26',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 12px 40px rgba(12, 18, 16, 0.12)',
      },
    },
  },
  plugins: [],
};
