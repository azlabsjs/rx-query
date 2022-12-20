
module.exports = {
  '*.{ts,js}': ['prettier --write', 'eslint --fix'],
  '*.html': ['prettier --write', 'eslint'],
  '*.{json,md,css}': ['prettier --write'],
};
