import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import { describe, expect, it } from 'vitest';
import {
	definitely_posix,
	get_config,
	get_ts_config,
	getDefaultProject,
} from '../src/helpers';

const definitely_posix_path = (...args) => definitely_posix(path.resolve(...args));

describe('helpers', () => {
	describe('getDefaultProject', () => {
		it('should be `tsconfig.json` if no process arguments set', () => {
			expect(getDefaultProject()).toBe('tsconfig.json');
		});

		it('should pick the tsconfig file name from the last process arg', () => {
			process.argv.push('custom.json');
			expect(getDefaultProject()).toBe('custom.json');
			process.argv.pop();
		});

		it('should only pick the config file name in the appropriate format', () => {
			process.argv.push('-custom.json');
			expect(getDefaultProject()).toBe('tsconfig.json');
			process.argv.pop();

			process.argv.push('--custom.json');
			expect(getDefaultProject()).toBe('tsconfig.json');
			process.argv.pop();
		});
	});

	describe('get_config', () => {
		it('should return base the config by default', async () => {
			const { ts_config, cwd, ...rest } = await get_config();

			// These will be tested separately
			expect(ts_config).toBeDefined();
			expect(cwd).toBeDefined();

			expect(rest).toEqual({
				cli_options: {
					project: 'tsconfig.json',
				},
				compiled_files: [
					'**/*.ts',
					'**/*.tsx',
					'**/*.js',
					'**/*.jsx',
				],
				ignored_files: [
					'**/*.ts',
					'**/*.tsx',
					'**/*.js',
					'**/*.jsx',
					'node_modules',
				],
				rules: [],
				use_ts_exclude: true,
			});
		});

		it('should load the changes from external config files', async () => {
			const _cwd = path.resolve('./test/tscp-config/use_ts_exclude');
			expect(fs.existsSync(_cwd)).toBe(true);

			const config = await get_config(_cwd);
			expect(config.use_ts_exclude).toBe(false);
		});

		it('should use the CLI options passed', async () => {
			const tsconfig_path = path.resolve('./test/typescript-config/extended/custom.json');
			expect(fs.existsSync(tsconfig_path)).toBe(true);

			process.argv.push('--watch', tsconfig_path);

			const config = await get_config();
			expect(config.cli_options).toEqual({
				project: tsconfig_path,
				watch: true,
			});

			process.argv.pop();
		});

		it('should use the custom `ignored_files` property if there is one', async () => {
			const _cwd = path.resolve('./test/tscp-config/ignored_files');
			expect(fs.existsSync(_cwd)).toBe(true);

			const config = await get_config(_cwd);

			expect(config.ignored_files).toEqual([
				'**/*.ts',
				'**/*.tsx',
				'**/*.js',
				'**/*.jsx',
				'ignored-file',
				'C:\\ignored\\path.js',
				'/path/to/ignored/file.js',

			]);

			// Compiled files should not change
			expect(config.compiled_files).toEqual([
				'**/*.ts',
				'**/*.tsx',
				'**/*.js',
				'**/*.jsx',
			]);
		});

		it('should use the custom `compiled_files` property if there is one', async () => {
			const _cwd = path.resolve('./test/tscp-config/compiled_files');
			expect(fs.existsSync(_cwd)).toBe(true);

			const config = await get_config(_cwd);

			expect(config.ignored_files).toEqual([
				'compiled-file',
				'C:\\compiled\\path.js',
				'/path/to/compiled/file.js',
				'node_modules',
			]);

			// Compiled files should not change
			expect(config.compiled_files).toEqual([
				'compiled-file',
				'C:\\compiled\\path.js',
				'/path/to/compiled/file.js',
			]);
		});
	});

	describe('get_ts_config', () => {
		it('should load and parse the requested config file', async () => {
			const _cwd = path.resolve('./test/typescript-config/base');
			expect(fs.existsSync(_cwd)).toBe(true);

			const ts_config = await get_ts_config(_cwd, 'tsconfig.json');

			expect(ts_config.errors).toEqual([]);
			expect(ts_config.fileNames).toEqual([definitely_posix_path(_cwd, 'src/index.ts')]);

			const _raw_tsconfig = require(path.join(_cwd, 'tsconfig.json'));
			expect(ts_config.raw).toMatchObject(_raw_tsconfig);
		});

		it('should handle TS project references', async () => {
			const _cwd = path.resolve('./test/typescript-config/project-references');
			expect(fs.existsSync(_cwd)).toBe(true);

			const ts_config = await get_ts_config(_cwd, 'tsconfig.json');

			expect(ts_config.errors).toEqual([]);
			expect(ts_config.fileNames).toEqual([]);

			const _raw_tsconfig = require(path.resolve(_cwd, 'tsconfig.json'));
			expect(ts_config.raw).toMatchObject(_raw_tsconfig);

			expect(ts_config.projectReferences).toEqual([
				{
					circular: undefined,
					originalPath: './core/tsconfig.json',
					path: definitely_posix_path(_cwd, 'core/tsconfig.json'),
					prepend: undefined,
				},
				{
					circular: undefined,
					originalPath: './animals/tsconfig.json',
					path: definitely_posix_path(_cwd, 'animals/tsconfig.json'),
					prepend: undefined,
				},
				{
					circular: undefined,
					originalPath: './zoo/tsconfig.json',
					path: definitely_posix_path(_cwd, 'zoo/tsconfig.json'),
					prepend: undefined,
				},
			]);
		});

		it('should throw error if the requested config file is not found', async () => {
			expect(() => get_ts_config(process.cwd(), 'not-existing-config.json')).toThrowError(
				'tsconfig.json not found',
			);
		});
	});
});
