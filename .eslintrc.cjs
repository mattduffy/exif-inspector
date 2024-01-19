module.exports = {
  globals: {
    window: true,
    document: true,
    origin: true,
  },
  env: {
    es2021: true,
    node: true,
  },
  extends: 'airbnb-base',
  overrides: [
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-use-before-define': ['error', {
      functions: false,
      classes: false,
      variables: true,
      allowNamedExports: true,
    }],
    semi: ['error', 'never'],
    'no-console': 'off',
    'no-underscore-dangle': 'off',
    'import/extensions': 'off',
    'import/prefer-default-export': 'off',
    'max-len': 'off',
    'new-cap': 'off',
  },
}
