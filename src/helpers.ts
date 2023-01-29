import * as path from 'path';
import * as fs from 'fs';
import { Command } from 'commander';
import ts, { ParsedCommandLine } from 'typescript';
import fse from 'fs-extra';
import pify from 'pify';
import rimraf from 'rimraf';
import { cosmiconfig } from 'cosmiconfig';
import { CliOptions, Config, LoaderMeta, Rule, RuleCondition, TsProject } from './types';

export const promisified = {
	fs: {
		...pify(fs),
		exists: pify(fs.exists, { errorFirst: false }),
		mkdir: pify(fs.mkdir, { errorFirst: false }),
	},
	fse: pify(fse),
	rimraf: pify(rimraf),
};

// https://stackoverflow.com/a/41407246/3111787
// https://en.wikipedia.org/wiki/ANSI_escape_code#Colors
export enum console_colors {
	Reset = '\x1b[0m',
	Bright = '\x1b[1m',
	Dim = '\x1b[2m',
	Underscore = '\x1b[4m',
	Blink = '\x1b[5m',
	Reverse = '\x1b[7m',
	Hidden = '\x1b[8m',

	FgBlack = '\x1b[30m',
	FgRed = '\x1b[31m',
	FgGreen = '\x1b[32m',
	FgYellow = '\x1b[33m',
	FgBlue = '\x1b[34m',
	FgMagenta = '\x1b[35m',
	FgCyan = '\x1b[36m',
	FgWhite = '\x1b[37m',

	BgBlack = '\x1b[40m',
	BgRed = '\x1b[41m',
	BgGreen = '\x1b[42m',
	BgYellow = '\x1b[43m',
	BgBlue = '\x1b[44m',
	BgMagenta = '\x1b[45m',
	BgCyan = '\x1b[46m',
	BgWhite = '\x1b[47m',

	FgBrightBlack = '\x1b[90m',
	FgBrightRed = '\x1b[91m',
	FgBrightGreen = '\x1b[92m',
	FgBrightYellow = '\x1b[93m',
	FgBrightBlue = '\x1b[94m',
	FgBrightMagenta = '\x1b[95m',
	FgBrightCyan = '\x1b[96m',
	FgBrightWhite = '\x1b[97m',

	BgBrightBlack = '\x1b[100m',
	BgBrightRed = '\x1b[101m',
	BgBrightGreen = '\x1b[102m',
	BgBrightYellow = '\x1b[103m',
	BgBrightBlue = '\x1b[104m',
	BgBrightMagenta = '\x1b[105m',
	BgBrightCyan = '\x1b[106m',
	BgBrightWhite = '\x1b[107m',
}

const version = require('../package.json').version;

export const getDefaultProject = (): string => {
	// process.argv = ['node_path', 'script_path', ...args]
	const lastArg = process.argv.slice(2).slice(-1)[0];

	if (lastArg && !lastArg.startsWith('-')) {
		return lastArg;
	}

	return 'tsconfig.json';
};

const defaultProject = getDefaultProject();

const program = new Command();

program
	.option('-w, --watch', 'Watch input files.')
	.option('-b, --build', 'Build one or more projects and their dependencies, if out of date')
	.option('-p , --project <path>', 'FILE OR DIRECTORY Compile the project given the path to its configuration file, or to a folder with a \'tsconfig.json\'', defaultProject)
	.version(version, '-v, --version');

program.parse(process.argv);

// @ts-ignore
const options: CliOptions = program.opts();

/**
 * Returns the complete, resolved configuration object
 */
export async function get_config() {
	const cwd = definitely_posix(process.cwd());

	const ts_config = get_ts_config(cwd, options.project);

	const explorer = cosmiconfig('tscp');
	const result = await explorer.search(cwd);

	const { config: project_config } = result || {};

	const default_config: Config = {
		cwd,
		cli_options: options,
		ts_config,
		use_ts_exclude: true,
		compiled_files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
		ignored_files: ['node_modules'],
		rules: [],
	};

	const config: Config = {
		...default_config,
		...project_config,
	};

	config.ignored_files = [...config.compiled_files, ...config.ignored_files];

	return config;
}

/**
 * Finds the `project` config file in `currentDir` and parses it with Typescript's own parser
 * @param currentDir
 * @param project
 */
export function get_ts_config(currentDir: string, project: string): ParsedCommandLine {
	const configFile = ts.findConfigFile(currentDir, ts.sys.fileExists, project);

	if (!configFile) throw Error('tsconfig.json not found');

	const { config } = ts.readConfigFile(configFile, ts.sys.readFile);

	return ts.parseJsonConfigFileContent(config, ts.sys, currentDir);
}

/**
 * Creates an internal project descriptor for one Typescript project
 * @param cwd
 * @param project_path
 * @param ts_config
 */
function build_project_path(cwd: string, project_path: string, ts_config: ParsedCommandLine): TsProject {
	const currentDirName = path.basename(path.resolve());
	const referenceName = path.relative(process.cwd(), cwd);
	const projectName = path.join(currentDirName, referenceName);

	const { exclude } = ts_config.raw;
	const { rootDir, outDir } = ts_config.options;

	if (!rootDir) {
		throw new Error(`No 'rootDir' configured in reference '${referenceName}'`);
	}

	if (!outDir) {
		throw new Error(`No 'outDir' configured in reference '${referenceName}'`);
	}

	return {
		project_name: projectName,
		base_path: cwd,
		ts_config_path: project_path,
		root_dir: rootDir,
		out_dir: outDir,
		exclude: exclude || [],
	};
}

/**
 * Returns the internal project descriptor of a TS project that doesn't have project references
 * @param options
 */
export function get_ts_project_paths(options: Config): TsProject {
	const { cwd, cli_options, ts_config } = options;

	return build_project_path(cwd, cli_options.project, ts_config);
}

/**
 * Returns the internal project descriptor of a TS project that has project references
 * @param options
 */
export function get_ts_projects_paths(options: Config): TsProject[] {
	const { ts_config } = options;

	if (!ts_config.projectReferences) {
		throw new Error('No project references configured');
	}

	return ts_config.projectReferences.map((reference) => {
		if (!reference.path) {
			throw new Error('Could not find project reference path');
		}

		if (!reference.originalPath) {
			throw new Error('Could not find project reference originalPath');
		}

		const cwd = path.dirname(reference.path);

		const referenceConfig = get_ts_config(cwd, reference.originalPath!);

		return build_project_path(cwd, reference.originalPath!, referenceConfig);
	});
}

/**
 * Combines the exclude pattern in the tsconfig file and the TSCP `config.ignored_files`
 * @param config
 * @param projects
 */
export function get_ignore_list(config: Config, projects: TsProject | TsProject[]): string[] {
	const ignore_list: string[] = [];

	if (config.use_ts_exclude) {
		const safe_projects = !Array.isArray(projects) ? [projects] : projects;

		const ts_exclude_list = safe_projects.map((project) => {
			return project.exclude.map((rule) => {
				// Handle if the exclude pattern contains the name of the root directory
				const rootDirName = project.root_dir.replace(project.base_path + '/', '') + '/';
				if (rule.startsWith(rootDirName)) {
					return rule.replace(rootDirName, '');
				}

				return rule;
			});
		}).flat();

		ignore_list.push(...ts_exclude_list);
	}

	ignore_list.push(...config.ignored_files);

	return ignore_list;
}

/**
 * Displays a colored log in the stdout
 * @param msg
 * @param color
 */
export function color_log(msg: string, color: typeof console_colors[keyof typeof console_colors]): string {
	return `${color}${msg}${console_colors.Reset}`;
}

/**
 * Makes sure that the given folder (or the parent folder of a file) exists - creates if not
 * @param p {string}
 */
export async function validate_path(p: string): Promise<void> {
	const dirname = path.dirname(p);

	if (!await promisified.fs.exists(dirname)) {
		await promisified.fs.mkdir(dirname, { recursive: true });
	}
}

/**
 * Error-safe `fs.lstat` - returns stats if the file exists, otherwise null
 * @param file_path
 */
export async function get_file_stats(file_path: string): Promise<fs.Stats | void> {
	try {
		return await promisified.fse.lstat(file_path);
	} catch (e) {
		return Promise.resolve();
	}
}

/**
 * Deletes the `file_path` file. Doesn't throw error if the file doesn't exist.
 * @param file_path
 */
export async function remove_file_or_directory(file_path: string): Promise<void> {
	const stats = await get_file_stats(file_path);

	if (!stats) {
		return Promise.resolve();
	}

	// console.log('DELETE', file_path);

	return promisified.rimraf(file_path);
}

const files_without_loaders: string[] = [];

/**
 * Reads the content of the `source_path` file, applies the loaders on its content, and writes the processed content to `destination_path`
 * @param source_path
 * @param destination_path
 * @param config
 */
export async function copy_file_or_directory(source_path: string, destination_path: string, config: Config) {
	const stats = await get_file_stats(source_path);

	if (!stats) {
		return;
	}

	const is_directory = stats.isDirectory();

	if (is_directory) {
		return promisified.fs.mkdir(destination_path);
	}

	// console.log('COPY', source_path, 'to', destination_path);

	const raw_content = await promisified.fse.readFile(source_path);

	const processed_content = await apply_loaders(raw_content, source_path, destination_path, config);

	await validate_path(destination_path);

	return promisified.fse.writeFile(destination_path, processed_content);
}

/**
 * Tests the given `source_path` against a given rule condition
 * @param source_path
 * @param rule_condition
 * @param config
 */
function test_rule_condition(source_path: string, rule_condition: RuleCondition, config: Config): boolean {
	if (Array.isArray(rule_condition)) {
		return rule_condition.every((sub_condition) => test_rule_condition(source_path, sub_condition, config));
	}

	// An exact absolute path string
	if (typeof rule_condition === 'string') {
		return rule_condition === source_path;
	}

	if (rule_condition instanceof RegExp) {
		return rule_condition.test(source_path);
	}

	if (typeof rule_condition === 'function') {
		return rule_condition(source_path);
	}

	return false;
}

/**
 * Tests the given `source_path` against every rule conditions
 * @param source_path
 * @param rule
 * @param config
 */
function apply_rule_condition(source_path: string, rule: Rule, config: Config): boolean {
	const isMatching: boolean | null = rule.test !== undefined ? test_rule_condition(source_path, rule.test, config) : null;
	const isIncluded: boolean | null = rule.include !== undefined ? test_rule_condition(source_path, rule.include, config) : null;
	const isExcluded: boolean | null = rule.exclude !== undefined ? test_rule_condition(source_path, rule.exclude, config) : null;

	if (isIncluded === true) {
		return true;
	}

	if (isExcluded === true) {
		return false;
	}

	if (isMatching === true) {
		return true;
	}

	return false;
}

/**
 * Passes the content of the source file to each loader in sequence and returns a Promise with the final content
 * @param raw_content
 * @param source_path
 * @param destination_path
 * @param config
 */
async function apply_loaders(raw_content: string, source_path: string, destination_path: string, config: Config): Promise<string> {
	let processed_content = raw_content;

	const should_process_file = files_without_loaders.indexOf(source_path) === -1;

	if (should_process_file) {
		const used_rules = config.rules.filter((rule) => apply_rule_condition(source_path, rule, config));

		if (!used_rules.length) {
			files_without_loaders.push(source_path);
			return raw_content;
		}

		const loaderMeta: LoaderMeta = {
			source_path,
			destination_path,
			config,
		};

		processed_content = await used_rules.reduce((content, rule) => {
			return [...rule.use].reverse().reduce((content, loader) => {
					let loaderFn;

					switch (typeof loader.loader) {
						case 'function':
							loaderFn = loader.loader;
							break;
						case 'string':
							loaderFn = require(path.resolve(loader.loader));
							break;
						default:
							throw new Error('Invalid loader type');
					}

					return loaderFn(content, loaderMeta);
				},
				processed_content,
			);
		}, processed_content);
	}

	return processed_content;
}

/**
 * Returns a Promise that resolves automatically after `ms`
 * @param ms
 */
export function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Converts your path `p` to POSIX format irrespective of whether you're already on POSIX platforms, or on win32
 * @param p path string
 * @see https://stackoverflow.com/a/63251716/3111787
 */
export function definitely_posix(p: string) {
	return p.split(path.sep).join(path.posix.sep);
}
