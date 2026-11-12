/** Static Tailwind CSS used by the GitHub Pages site. */
module.exports = {
  content: [
    './site-templates/**/*.html',
    './*.html',
    './services/**/*.html',
    './case-studies/**/*.html',
    './assets/js/**/*.js',
    './admin/**/*.js'
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
