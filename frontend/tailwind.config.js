/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'border-pulse': 'border-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'border-pulse': {
          '0%, 100%': {
            borderColor: 'rgb(59, 130, 246)',
            boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.7)'
          },
          '50%': {
            borderColor: 'rgb(37, 99, 235)',
            boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3)'
          },
        }
      }
    },
  },
  plugins: [],
}
