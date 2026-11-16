import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Lint rules.  The important ones for a React newcomer are the React Hooks rules: hooks must be
 * called unconditionally, at the top level of a component or another hook, and an effect must list
 * everything it reads in its dependency array.  Angular has no equivalent rules because it has no
 * equivalent constraint; in React, breaking them causes subtle bugs, so `npm run lint` checks them.
 */
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'src/app/core/model/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
