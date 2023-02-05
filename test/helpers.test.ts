import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import { describe, expect, it, vitest } from 'vitest';
import rimraf from 'rimraf';
// @ts-ignore
import { getFileList, readFolderContent, restoreFolderContent } from './utils/fs';
import {
	apply_rule_condition,
	build_project_path,
	copy_file_or_directory,
	definitely_posix,
	get_config,
	get_file_stats,
	get_ignore_list,
	get_ts_config,
	get_ts_project_paths,
	get_ts_projects_paths,
	getDefaultProject,
	remove_file_or_directory,
	test_rule_condition,
	validate_path,
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

	describe('get_ignore_list', () => {
		it('should collect the get_ignore_list rules from the TSCP and the TS config files', async () => {
			const _cwd = path.resolve('./test/fs-actions/get_ignore_list');
			expect(fs.existsSync(_cwd)).toBe(true);

			const config = await get_config(_cwd);

			const projects = get_ts_project_paths(config);

			expect(get_ignore_list(config, projects)).toEqual([
				'ts-rule/ignored-file-ts.txt',
				'ts-rule/folder',
				'ts-rule/with-rootDir',
				'**/*.ts',
				'**/*.tsx',
				'**/*.js',
				'**/*.jsx',
				'tscp-rule/ignored-file-ts.txt',
				'tscp-rule/folder',
				'src/tscp-rule/with-rootDir',
			]);
		});
	});

	describe('validate_path', () => {
		it('should create the folder tree recursively if it doesn\'t exist', async () => {
			const _cwd = path.resolve('./test/fs-actions/validate_path');
			expect(fs.existsSync(_cwd)).toBe(true);

			const newFolderPath = path.resolve(_cwd, 'new-folder');
			const newFilePath = path.resolve(newFolderPath, 'sub-folder/file3.js');
			expect(fs.existsSync(newFilePath)).toBe(false);

			const response = await validate_path(newFilePath);
			expect(response).toBe(undefined);

			// The file shouldn't be created, only the folder
			expect(fs.existsSync(newFilePath)).toBe(false);

			const newFileDirname = path.dirname(newFilePath);
			expect(newFileDirname).toBe(newFilePath.replace(`${path.sep}file3.js`, ''));

			// But the folder should be there
			expect(fs.existsSync(newFileDirname)).toBe(true);

			// Clean up
			rimraf.sync(newFolderPath);
			expect(fs.existsSync(newFileDirname)).toBe(false);
		});

		it('shouldn\'t change anything in the file system if the folder exists', async () => {
			const _cwd = path.resolve('./test/fs-actions/validate_path');
			expect(fs.existsSync(_cwd)).toBe(true);

			const dir_structure = await getFileList(_cwd);
			expect(dir_structure).toEqual([
				path.resolve(_cwd, 'existing-folder/file.txt'),
			]);

			const newFilePath = path.resolve(_cwd, 'existing-folder/file.txt');
			expect(fs.existsSync(newFilePath)).toBe(true);

			const response = await validate_path(newFilePath);
			expect(response).toBe(undefined);

			// Nothing should be changed
			expect(await getFileList(_cwd)).toEqual(dir_structure);
		});
	});

	describe('get_file_stats', () => {
		it('should return stats for an existing file', async () => {
			const _cwd = path.resolve('./test/fs-actions/validate_path');
			expect(fs.existsSync(_cwd)).toBe(true);

			const existingFilePath = path.resolve(_cwd, 'existing-folder/file.txt');
			expect(fs.existsSync(existingFilePath)).toBe(true);

			const response = await get_file_stats(existingFilePath);

			expect(response).not.toBe(undefined); // TODO Later this should be `null`
			expect(response).toHaveProperty('dev');
			expect(response).toHaveProperty('mode');
			expect(response).toHaveProperty('nlink');
			expect(response).toHaveProperty('isDirectory');
		});

		it('should return undefined for a not existing file', async () => {
			const _cwd = path.resolve('./test/fs-actions/validate_path');
			expect(fs.existsSync(_cwd)).toBe(true);

			const notExistingFilePath = path.resolve(_cwd, 'not-existing-folder/file.txt');
			expect(fs.existsSync(notExistingFilePath)).toBe(false);

			// it shouldn't throw error like normal `lstat` would throw.
			expect(async () => await get_file_stats(notExistingFilePath)).not.toThrowError();

			const response = await get_file_stats(notExistingFilePath);
			expect(response).toBe(undefined);
		});
	});

	describe('remove_file_or_directory', () => {
		it('should delete a file', async () => {
			const _cwd = path.resolve('./test/fs-actions/remove_file_or_directory');
			expect(fs.existsSync(_cwd)).toBe(true);

			const existingFilePath = path.resolve(_cwd, 'file.css');
			expect(fs.existsSync(existingFilePath)).toBe(true);

			const folderContent = await readFolderContent(_cwd);
			const existingFileDescriptor = folderContent.find(({ filePath }) => filePath === existingFilePath);
			expect(existingFileDescriptor).toEqual({
				filePath: existingFilePath,
				fileData: Buffer.from('/* file.css */\n', 'utf-8'),
			});

			const response = await remove_file_or_directory(existingFilePath);
			expect(response).toBe(undefined);
			expect(fs.existsSync(existingFilePath)).toBe(false);

			// Restore deleted file
			await restoreFolderContent(_cwd, folderContent);
			expect(fs.existsSync(existingFilePath)).toBe(true);
			expect(await fs.promises.readFile(existingFilePath)).toEqual(existingFileDescriptor?.fileData);
		});

		it('should delete an empty folder', async () => {
			const _cwd = path.resolve('./test/fs-actions/remove_file_or_directory');
			expect(fs.existsSync(_cwd)).toBe(true);

			const emptyFolderPath = path.resolve(_cwd, 'empty-folder');
			expect(fs.existsSync(emptyFolderPath)).toBe(false);

			await fs.promises.mkdir(emptyFolderPath);
			expect(fs.existsSync(emptyFolderPath)).toBe(true);

			const response = await remove_file_or_directory(emptyFolderPath);
			expect(response).toBe(undefined);
			expect(fs.existsSync(emptyFolderPath)).toBe(false);
		});

		it('should delete a not empty folder', async () => {
			const _cwd = path.resolve('./test/fs-actions/remove_file_or_directory');
			expect(fs.existsSync(_cwd)).toBe(true);

			const notEmptyFolderPath = path.resolve(_cwd, 'sub-folder');
			expect(fs.existsSync(notEmptyFolderPath)).toBe(true);

			const childFilePath = path.resolve(notEmptyFolderPath, 'file.js');
			expect(fs.existsSync(childFilePath)).toBe(true);

			const folderContent = await readFolderContent(_cwd);
			// TODO Create separate unit tests for `readFolderContent` and `restoreFolderContent`
			const childFileDescriptor = folderContent.find(({ filePath }) => filePath === childFilePath);
			expect(childFileDescriptor).toEqual({
				filePath: path.resolve(notEmptyFolderPath, 'file.js'),
				fileData: Buffer.from('', 'utf-8'),
			});

			const response = await remove_file_or_directory(notEmptyFolderPath);
			expect(response).toBe(undefined);
			expect(fs.existsSync(notEmptyFolderPath)).toBe(false);

			await restoreFolderContent(_cwd, folderContent);
			expect(fs.existsSync(childFilePath)).toBe(true);
			expect(await fs.promises.readFile(childFilePath)).toEqual(childFileDescriptor?.fileData);
		});
	});

	describe('copy_file_or_directory', () => {
		it('should copy a file', async () => {
			const _source_cwd = path.resolve('./test/fs-actions/remove_file_or_directory');
			expect(fs.existsSync(_source_cwd)).toBe(true);

			const _target_cwd = path.resolve('./test/fs-actions/copy_file_or_directory');
			expect(fs.existsSync(_target_cwd)).toBe(true);

			const sourceFilePath = path.resolve(_source_cwd, 'file.css');
			expect(fs.existsSync(sourceFilePath)).toBe(true);

			const targetFilePath = path.resolve(_target_cwd, 'copied-file.css');
			expect(fs.existsSync(targetFilePath)).toBe(false);

			const config = await get_config();

			const targetFolderContent = await readFolderContent(_target_cwd);

			await copy_file_or_directory(sourceFilePath, targetFilePath, config);
			expect(fs.existsSync(targetFilePath)).toBe(true);

			await restoreFolderContent(_target_cwd, targetFolderContent);
		});

		it('should copy a directory', async () => {
			const _source_cwd = path.resolve('./test/fs-actions/remove_file_or_directory');
			expect(fs.existsSync(_source_cwd)).toBe(true);

			const _target_cwd = path.resolve('./test/fs-actions/copy_file_or_directory');
			expect(fs.existsSync(_target_cwd)).toBe(true);

			const sourceFolderPath = path.resolve(_source_cwd, 'sub-folder');
			expect(fs.existsSync(sourceFolderPath)).toBe(true);

			const sourceChildFilePath = path.resolve(sourceFolderPath, 'file.js');
			expect(fs.existsSync(sourceChildFilePath)).toBe(true);

			const targetFolderPath = path.resolve(_target_cwd, 'copied-sub-folder');
			expect(fs.existsSync(targetFolderPath)).toBe(false);

			const targetChildFilePath = path.resolve(targetFolderPath, 'file.js');
			expect(fs.existsSync(targetChildFilePath)).toBe(false);

			const config = await get_config();

			const targetFolderContent = await readFolderContent(_target_cwd);

			await copy_file_or_directory(sourceFolderPath, targetFolderPath, config);
			expect(fs.existsSync(targetFolderPath)).toBe(true);
			expect(fs.existsSync(targetChildFilePath)).toBe(false);

			await restoreFolderContent(_target_cwd, targetFolderContent);
		});

		it('should overwrite existing files', async () => {
			const _source_cwd = path.resolve('./test/fs-actions/remove_file_or_directory');
			expect(fs.existsSync(_source_cwd)).toBe(true);

			const _target_cwd = path.resolve('./test/fs-actions/copy_file_or_directory');
			expect(fs.existsSync(_target_cwd)).toBe(true);

			const sourceFilePath = path.resolve(_source_cwd, 'file.css');
			expect(fs.existsSync(sourceFilePath)).toBe(true);

			const targetFilePath = path.resolve(_target_cwd, 'existing-file.css');
			expect(fs.existsSync(targetFilePath)).toBe(true);

			const sourceFileContent = await fs.promises.readFile(sourceFilePath, 'utf-8');
			expect(sourceFileContent).toBe('/* file.css */\n');

			const targetFileContent = await fs.promises.readFile(targetFilePath, 'utf-8');
			expect(targetFileContent).toBe('/* existing-file.css */\n');

			const config = await get_config();

			const targetFolderContent = await readFolderContent(_target_cwd);

			await copy_file_or_directory(sourceFilePath, targetFilePath, config);
			expect(fs.existsSync(targetFilePath)).toBe(true);
			expect(await fs.promises.readFile(targetFilePath, 'utf-8')).toBe(sourceFileContent);

			await restoreFolderContent(_target_cwd, targetFolderContent);
		});

		it('should apply loaders on the processed files', async () => {
			const _source_cwd = path.resolve('./test/loaders');
			expect(fs.existsSync(_source_cwd)).toBe(true);

			const _target_cwd = path.resolve('./test/fs-actions/copy_file_or_directory');
			expect(fs.existsSync(_target_cwd)).toBe(true);

			const sourceFilePath = path.resolve(_source_cwd, 'basic.sass');
			expect(fs.existsSync(sourceFilePath)).toBe(true);

			const targetFilePath = path.resolve(_target_cwd, 'basic.sass');
			expect(fs.existsSync(targetFilePath)).toBe(false);

			const sourceFileContent = await fs.promises.readFile(sourceFilePath, 'utf-8');
			expect(sourceFileContent).toBe('// basic.sass\n');

			const config = await get_config();
			config.rules = [
				{
					test: /\.s(a|ac)ss$/,
					use: [
						{
							loader: (content) => content.replace('loader 2', 'loader 1 + 2'),
						},
						{
							loader: (content) => content + '/* loader 2 */\n',
						},
					],
				},
			];

			const targetFolderContent = await readFolderContent(_target_cwd);

			await copy_file_or_directory(sourceFilePath, targetFilePath, config);
			expect(fs.existsSync(targetFilePath)).toBe(true);
			expect(await fs.promises.readFile(targetFilePath, 'utf-8')).toBe('// basic.sass\n/* loader 1 + 2 */\n');

			await restoreFolderContent(_target_cwd, targetFolderContent);
		});
	});

	describe('test_rule_condition', () => {
		describe('string rules', async () => {
			const config = await get_config();

			const rule_condition = path.resolve('./test.sass');

			it('should match the same filename in the same directory, but only with absolute path', () => {
				expect(test_rule_condition(path.resolve('./test.sass'), rule_condition, config)).toBe(true);
				expect(test_rule_condition('./test.sass', rule_condition, config)).toBe(false);

				// this is the same
				expect(test_rule_condition(path.resolve('test.sass'), rule_condition, config)).toBe(true);
				expect(test_rule_condition('test.sass', rule_condition, config)).toBe(false);
			});

			it('should not match other filename in the same directory', () => {
				expect(test_rule_condition(path.resolve('./test.scss'), rule_condition, config)).toBe(false);
				expect(test_rule_condition('./test.css', rule_condition, config)).toBe(false);
			});

			it('should not match the same filename in other directory', () => {
				expect(test_rule_condition(path.resolve('../../test.sass'), rule_condition, config)).toBe(false);
				expect(test_rule_condition('../../test.sass', rule_condition, config)).toBe(false);
			});
		});

		describe('regexp rules', async () => {
			const config = await get_config();

			const sass_regexp1 = /\.s(a|c)ss$/;

			it('should match .sass files', () => {
				expect(test_rule_condition(path.resolve('./test.sass'), sass_regexp1, config)).toBe(true);
				expect(test_rule_condition('./test.sass', sass_regexp1, config)).toBe(true);
			});

			it('should match .scss files', () => {
				expect(test_rule_condition(path.resolve('../../test.scss'), sass_regexp1, config)).toBe(true);
				expect(test_rule_condition('../../test.scss', sass_regexp1, config)).toBe(true);
			});

			it('should not match .css files', () => {
				expect(test_rule_condition(path.resolve('./test.css'), sass_regexp1, config)).toBe(false);
				expect(test_rule_condition('./test.css', sass_regexp1, config)).toBe(false);
			});
		});

		describe('should handle callback rules', async () => {
			const config = await get_config();

			it('should call the callback function with the file\'s source path', () => {
				const cb = vitest.fn();

				test_rule_condition('filename.js', cb, config);

				expect(cb).toBeCalledTimes(1);
				expect(cb).toBeCalledWith('filename.js');
			});

			it('should return the value of the callback function', () => {
				expect(test_rule_condition('./example.js', () => true, config)).toBe(true);
				expect(test_rule_condition('./example.js', () => false, config)).toBe(false);
			});

			// TODO This shouldn't be like this. We should convert the return value to boolean.
			//  Even though `apply_rule_condition` will only accept true, and anything else will treated as false.
			it('should allow any truthy/falsy return values for the callback\'s return value', () => {
				// @ts-expect-error
				expect(test_rule_condition('./example.js', () => null, config)).toBe(null);
				// @ts-expect-error
				expect(test_rule_condition('./example.js', () => undefined, config)).toBe(undefined);
				// @ts-expect-error
				expect(test_rule_condition('./example.js', () => '', config)).toBe('');
			});
		});

		describe('array of rules', async () => {
			const config = await get_config();

			it('should handle array of rules', () => {
				const file_path = path.resolve('./test.sass');

				expect(test_rule_condition(file_path, [/\.s(a|c)ss$/], config)).toBe(true);
			});

			it('should return true only when the source_path matches all of the rules', () => {
				const file_path = path.resolve('./test.sass');

				// OK
				expect(test_rule_condition(file_path, [/\.s(a|c)ss$/, /\.sass$/], config)).toBe(true);

				// At least one rule doesn't match
				expect(test_rule_condition(file_path, [/\.s(a|c)ss$/, /\.scss$/], config)).toBe(false);
				expect(test_rule_condition(file_path, [/\.s(a|c)ss$/, /\.sass$/, path.resolve('sub-folder/test.sass')], config)).toBe(false);

				// None of the rules match
				expect(test_rule_condition(file_path, [/\.js$/, /\.scss$/], config)).toBe(false);

				// relative paths cannot be used as a rule
				expect(test_rule_condition(file_path, [/\.s(a|c)ss$/, 'test.sass'], config)).toBe(false);
			});

			it('should work normally for every rule condition type', () => {
				const file_path = path.resolve('./test.sass');

				expect(test_rule_condition(file_path, [/\.s(a|c)ss$/], config)).toBe(true);
				expect(test_rule_condition(file_path, [file_path], config)).toBe(true);
				expect(test_rule_condition(file_path, [() => true], config)).toBe(true);

				expect(test_rule_condition(file_path, [/\.css$/], config)).toBe(false);
				expect(test_rule_condition(file_path, ['test.sass'], config)).toBe(false);
				expect(test_rule_condition(file_path, [() => false], config)).toBe(false);
			});

			it('should call one callback only once', () => {
				const cb = vitest.fn();
				const file_path = path.resolve('./test.sass');

				test_rule_condition(file_path, [file_path, cb, /\.css$/], config);

				expect(cb).toBeCalledTimes(1);
				expect(cb).toBeCalledWith(file_path);
			});

			it('shouldn\'t call the callback if there is a previous, non-matching rule in the chain', () => {
				const cb = vitest.fn();
				const file_path = path.resolve('./test.sass');

				test_rule_condition(file_path, ['test.sass', cb, /\.css$/], config);

				expect(cb).toBeCalledTimes(0);
			});
		});
	});

	describe('apply_rule_condition', async () => {
		const config = await get_config();

		it('should handle `rule.test`', () => {
			expect(apply_rule_condition(path.resolve('file.sass'), {
				test: /\.sass$/,
				use: [],
			}, config)).toBe(true);

			expect(apply_rule_condition(path.resolve('file.sass'), {
				test: () => true,
				use: [],
			}, config)).toBe(true);

			expect(apply_rule_condition(path.resolve('file.js'), {
				test: /\.css$/,
				use: [],
			}, config)).toBe(false);
		});

		it('should handle `rule.include', () => {
			expect(apply_rule_condition(path.resolve('file.sass'), {
				include: /\.sass$/,
				use: [],
			}, config)).toBe(true);

			expect(apply_rule_condition(path.resolve('file.sass'), {
				include: /\.scss$/,
				use: [],
			}, config)).toBe(false);

			expect(apply_rule_condition(path.resolve('file.js'), {
				include: () => false,
				use: [],
			}, config)).toBe(false);
		});

		it('should handle `rule.exclude`', () => {
			// We should also use at least one matching condition in case of `exclude`, to get a truthy output.
			// We use `test`, because that is weaker than `exclude`. `include` would supersede the exclusion rule.
			expect(apply_rule_condition(path.resolve('file.sass'), {
				test: () => true,
				exclude: /\.scss$/,
				use: [],
			}, config)).toBe(true);

			expect(apply_rule_condition(path.resolve('file.scss'), {
				test: () => true,
				exclude: /\.scss$/,
				use: [],
			}, config)).toBe(false);

			expect(apply_rule_condition(path.resolve('file.js'), {
				test: () => true,
				exclude: () => true,
				use: [],
			}, config)).toBe(false);
		});

		it('should keep the condition strength order - 1: include, 2: exclude, 3: test', () => {
			// INCLUDE
			// If a file is explicitly included, it _will_ be included - even if it is explicitly excluded
			expect(apply_rule_condition(path.resolve('file.scss'), {
				include: /\.scss$/,
				exclude: /\.scss$/,
				use: [],
			}, config)).toBe(true);

			expect(apply_rule_condition(path.resolve('file.scss'), {
				include: /\.scss$/,
				use: [],
			}, config)).toBe(true);

			expect(apply_rule_condition(path.resolve('file.scss'), {
				include: /\.scss$/,
				test: /\.js$/,
				use: [],
			}, config)).toBe(true);

			// EXCLUDE
			// If a file is explicitly excluded, it _will_ be excluded - _unless it is explicitly included_
			expect(apply_rule_condition(path.resolve('file.scss'), {
				exclude: /\.scss$/,
				include: /\.sass$/,
				use: [],
			}, config)).toBe(false);

			expect(apply_rule_condition(path.resolve('file.scss'), {
				exclude: /\.scss$/,
				test: /\.js$/,
				use: [],
			}, config)).toBe(false);

			expect(apply_rule_condition(path.resolve('file.scss'), {
				exclude: /\.scss$/,
				include: /\.scss$/,
				use: [],
			}, config)).toBe(true);

			// TEST
			// If the file is matched, it will be included - _unless it is explicitly included_
			expect(apply_rule_condition(path.resolve('file.scss'), {
				test: /\.scss$/,
				use: [],
			}, config)).toBe(true);

			expect(apply_rule_condition(path.resolve('file.scss'), {
				test: /\.scss$/,
				exclude: /\.sass$/,
				use: [],
			}, config)).toBe(true);

			expect(apply_rule_condition(path.resolve('file.scss'), {
				test: /\.scss$/,
				exclude: /\.scss$/,
				use: [],
			}, config)).toBe(false);
		});

		it('should accept only `true` as permissive callback value', () => {
			expect(apply_rule_condition('file.js', {
				test: () => true,
				use: [],
			}, config)).toBe(true);

			expect(apply_rule_condition('file.js', {
				// @ts-expect-error
				test: () => 1,
				use: [],
			}, config)).toBe(false);

			expect(apply_rule_condition('file.js', {
				// @ts-expect-error
				test: () => undefined,
				use: [],
			}, config)).toBe(false);

			expect(apply_rule_condition('file.js', {
				// @ts-expect-error
				test: () => 'string',
				use: [],
			}, config)).toBe(false);
		});

		it('shouldn\'t apply loader if none of the conditions are met', () => {
			expect(apply_rule_condition('file.js', {
				test: /\.ts$/,
				exclude: /\.tsx$/,
				include: /\.jsx$/,
				use: [],
			}, config)).toBe(false);

			expect(apply_rule_condition(path.resolve('file.txt'), {
				test: /\.ts$/,
				exclude: () => false,
				include: path.resolve('sub-folder/file.txt'),
				use: [],
			}, config)).toBe(false);
		});

		// TODO Obviously this shouldn't be like this. Don't call `rule.test`, if the file is e.g. excluded.
		it('should test the file against each condition before making a decision', () => {
			const cb_include = vitest.fn();
			const cb_exclude = vitest.fn();
			const cb_test = vitest.fn();

			// Test 1
			apply_rule_condition(path.resolve('file.txt'), {
				include: cb_include,
				exclude: () => {
					cb_exclude();
					return true;
				},
				test: cb_test,
				use: [],
			}, config);

			expect(cb_include).toBeCalledTimes(1);
			expect(cb_exclude).toBeCalledTimes(1);
			// cb_test shouldn't be called, because exclude already returned `true`
			expect(cb_test).toBeCalledTimes(1);

			// Test 2
			apply_rule_condition(path.resolve('file.txt'), {
				include: () => {
					cb_include();
					return true;
				},
				exclude: cb_exclude,
				test: cb_test,
				use: [],
			}, config);

			expect(cb_include).toBeCalledTimes(2);
			// cb_exclude and cb_test shouldn't be called, because exclude already returned `true`
			expect(cb_exclude).toBeCalledTimes(2);
			expect(cb_test).toBeCalledTimes(2);
		});
	});
});
