import globals from 'globals';
import tseslint from 'typescript-eslint';
import json from '@eslint/json';
import css from '@eslint/css';
import { defineConfig } from 'eslint/config';

export default defineConfig([
	{ files: ['**/*.{js,mjs,cjs,ts,mts,cts}'], languageOptions: { globals: globals.node } },
	tseslint.configs.recommended,
	{ files: ['**/*.json'], plugins: { json }, language: 'json/json' },
	{ files: ['**/*.css'], plugins: { css }, language: 'css/css' },
	{
		rules: {
			'@typescript-eslint/no-unused-vars': 'warn',
		},
	},
]);
