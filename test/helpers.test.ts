import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import { describe, expect, it } from 'vitest';
import {
	build_project_path,
	definitely_posix,
	get_config,
	get_ts_config,
	get_ts_project_paths,
	get_ts_projects_paths,
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

	describe('build_project_path', () => {
		it('should handle a TS project without project references', () => {
			const _cwd = path.resolve('./test/typescript-config/base');
			expect(fs.existsSync(_cwd)).toBe(true);

			const _tsconfig_path = path.resolve(_cwd, 'tsconfig.json');
			expect(fs.existsSync(_tsconfig_path)).toBe(true);

			const _tsconfig = get_ts_config(_cwd, 'tsconfig.json');

			expect(build_project_path(_cwd, _tsconfig_path, _tsconfig)).toEqual({
				base_path: _cwd,
				exclude: [
					'node_modules',
					'dist',
				],
				out_dir: definitely_posix_path(_cwd, 'dist'),
				project_name: 'typescript-cp\\test\\typescript-config\\base',
				root_dir: definitely_posix_path(_cwd, 'src'),
				ts_config_path: _tsconfig_path,
			});
		});

		it('should handle a TS project with project references', () => {
			const _cwd = path.resolve('./test/typescript-config/project-references/core');
			expect(fs.existsSync(_cwd)).toBe(true);

			const _tsconfig_path = path.resolve(_cwd, 'tsconfig.json');
			expect(fs.existsSync(_tsconfig_path)).toBe(true);

			const _tsconfig = get_ts_config(_cwd, 'tsconfig.json');

			expect(build_project_path(_cwd, _tsconfig_path, _tsconfig)).toEqual({
				base_path: _cwd,
				exclude: [],
				out_dir: definitely_posix_path(_cwd, '../lib/core'),
				project_name: 'typescript-cp\\test\\typescript-config\\project-references\\core',
				root_dir: definitely_posix_path(_cwd, ''),
				ts_config_path: _tsconfig_path,
			});
		});

		it('should throw error if `rootDir` is not set in the TS config file', () => {
			const _cwd = path.resolve('./test/typescript-config/no-rootDir');
			expect(fs.existsSync(_cwd)).toBe(true);

			const _tsconfig_path = path.resolve(_cwd, 'tsconfig.json');
			expect(fs.existsSync(_tsconfig_path)).toBe(true);

			const _tsconfig = get_ts_config(_cwd, 'tsconfig.json');

			expect(() => build_project_path(_cwd, _tsconfig_path, _tsconfig)).toThrowError(
				'No \'rootDir\' configured in reference \'test\\typescript-config\\no-rootDir\'',
			);
		});

		it('should throw error if `outDir` is not set in the TS config file', () => {
			const _cwd = path.resolve('./test/typescript-config/no-outDir');
			expect(fs.existsSync(_cwd)).toBe(true);

			const _tsconfig_path = path.resolve(_cwd, 'tsconfig.json');
			expect(fs.existsSync(_tsconfig_path)).toBe(true);

			const _tsconfig = get_ts_config(_cwd, 'tsconfig.json');

			expect(() => build_project_path(_cwd, _tsconfig_path, _tsconfig)).toThrowError(
				'No \'outDir\' configured in reference \'test\\typescript-config\\no-outDir\'',
			);
		});
	});

	describe('get_ts_project_paths', () => {
		it('should handle a TS project without project references', async () => {
			const _cwd = path.resolve('./test/typescript-config/base');
			expect(fs.existsSync(_cwd)).toBe(true);

			const _tsconfig_path = path.resolve(_cwd, 'tsconfig.json');
			expect(fs.existsSync(_tsconfig_path)).toBe(true);

			const config = await get_config(_cwd);

			expect(get_ts_project_paths(config)).toEqual({
				base_path: definitely_posix_path(_cwd),
				exclude: [
					'node_modules',
					'dist',
				],
				out_dir: definitely_posix_path(_cwd, 'dist'),
				project_name: 'typescript-cp\\test\\typescript-config\\base',
				root_dir: definitely_posix_path(_cwd, 'src'),
				ts_config_path: 'tsconfig.json',
			});
		});

		it('should handle a TS project with project references', async () => {
			const _cwd = path.resolve('./test/typescript-config/project-references');
			expect(fs.existsSync(_cwd)).toBe(true);

			const _tsconfig_path = path.resolve(_cwd, 'tsconfig.json');
			expect(fs.existsSync(_tsconfig_path)).toBe(true);

			const config = await get_config(_cwd);

			expect(get_ts_project_paths(config)).toEqual({
				base_path: definitely_posix_path(_cwd),
				exclude: [],
				out_dir: definitely_posix_path(_cwd, '../lib'),
				project_name: 'typescript-cp\\test\\typescript-config\\project-references',
				root_dir: definitely_posix_path(_cwd, ''),
				ts_config_path: 'tsconfig.json',
			});
		});
	});

	describe('get_ts_projects_paths', () => {
		it('should throw error for a TS project without project references', async () => {
			const _cwd = path.resolve('./test/typescript-config/base');
			expect(fs.existsSync(_cwd)).toBe(true);

			const config = await get_config(_cwd);

			expect(() => get_ts_projects_paths(config)).toThrowError('No project references configured');
		});

		it('should handle a TS project with project references', async () => {
			const _cwd = path.resolve('./test/typescript-config/project-references');
			expect(fs.existsSync(_cwd)).toBe(true);

			const _tsconfig_path = path.resolve(_cwd, 'tsconfig.json');
			expect(fs.existsSync(_tsconfig_path)).toBe(true);

			const config = await get_config(_cwd);

			expect(get_ts_projects_paths(config)).toEqual([
				{
					base_path: definitely_posix_path(_cwd, 'core'),
					exclude: [],
					out_dir: definitely_posix_path(_cwd, 'lib/core'),
					project_name: 'typescript-cp\\test\\typescript-config\\project-references\\core',
					root_dir: definitely_posix_path(_cwd, 'core'),
					ts_config_path: './core/tsconfig.json',
				},
				{
					base_path: definitely_posix_path(_cwd, 'animals'),
					exclude: [],
					out_dir: definitely_posix_path(_cwd, 'lib/animals'),
					project_name: 'typescript-cp\\test\\typescript-config\\project-references\\animals',
					root_dir: definitely_posix_path(_cwd, 'animals'),
					ts_config_path: './animals/tsconfig.json',
				},
				{
					base_path: definitely_posix_path(_cwd, 'zoo'),
					exclude: [],
					out_dir: definitely_posix_path(_cwd, 'lib/zoo'),
					project_name: 'typescript-cp\\test\\typescript-config\\project-references\\zoo',
					root_dir: definitely_posix_path(_cwd, 'zoo'),
					ts_config_path: './zoo/tsconfig.json',
				},
			]);
		});
	});
});
