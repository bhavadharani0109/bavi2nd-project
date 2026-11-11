import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'functions/lib/**/*'],
  },
  {
    files: ['**/firestore.rules', '**/DRAFT_firestore.rules'],
    plugins: {
      '@firebase/security-rules': firebaseRulesPlugin,
    },
    languageOptions: {
      parser: firebaseRulesPlugin.parser,
    },
    rules: {
      '@firebase/security-rules/no-open-reads': 'error',
      '@firebase/security-rules/no-open-writes': 'error',
      '@firebase/security-rules/no-redundant-matches': 'error',
    },
  },
];
