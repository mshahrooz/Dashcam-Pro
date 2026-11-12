/** Production Tailwind v3 build matching the previous Tailwind CDN theme. */
module.exports = {
  content: [
    './site-templates/**/*.html',
    './*.html',
    './services/**/*.html',
    './case-studies/**/*.html',
    './admin/**/*.html',
    './assets/js/**/*.js'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
};
