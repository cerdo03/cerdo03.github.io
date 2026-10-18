export default [{ ignores: ['labs/attention/architecture-explorer/vendor/**'] }, {
  files: ['assets/**/*.js', 'labs/**/*.js', 'scripts/**/*.mjs'],
  rules: {
    'no-unreachable': 'error',
    'no-dupe-keys': 'error',
    'valid-typeof': 'error',
  },
}];
