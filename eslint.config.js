import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', '.snaps', '.sim', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/core/**/*.ts', 'src/codex/**/*.ts', 'src/sim/**/*.ts'],
    rules: {
      // The rules engine and content stay pure: no engine, no DOM, no ambient randomness.
      'no-restricted-imports': ['error', { patterns: ['phaser', '../scenes/*', '../view/*', '../debug/*'] }],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in src/core/rng.ts.' },
        { object: 'Date', property: 'now', message: 'Core must be deterministic.' },
      ],
    },
  },
);
