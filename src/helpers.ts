import * as path from 'path';
import * as fs from 'fs';
import { Command } from 'commander';
import ts, { ParsedCommandLine } from 'typescript';
import fse from 'fs-extra';
import pify from 'pify';
import rimraf from 'rimraf';
import { cosmiconfig } from 'cosmiconfig';
import { CliOptions, Config, TsProject } from './types';

const promisified = {
	fs: {
		...pify(fs),
		exists: pify(fs.exists, { errorFirst: false }),
	},
	fse: pify(fse),
	rimraf: pify(rimraf),
};

// https://stackoverflow.com/a/41407246/3111787
// https://en.wikipedia.org/wiki/ANSI_escape_code#Colors
const console_colors = {
	Reset: '\x1b[0m',
	Bright: '\x1b[1m',
	Dim: '\x1b[2m',
	Underscore: '\x1b[4m',
	Blink: '\x1b[5m',
	Reverse: '\x1b[7m',
	Hidden: '\x1b[8m',

	FgBlack: '\x1b[30m',
	FgRed: '\x1b[31m',
	FgGreen: '\x1b[32m',
	FgYellow: '\x1b[33m',
	FgBlue: '\x1b[34m',
	FgMagenta: '\x1b[35m',
	FgCyan: '\x1b[36m',
	FgWhite: '\x1b[37m',

	BgBlack: '\x1b[40m',
	BgRed: '\x1b[41m',
	BgGreen: '\x1b[42m',
	BgYellow: '\x1b[43m',
	BgBlue: '\x1b[44m',
	BgMagenta: '\x1b[45m',
	BgCyan: '\x1b[46m',
	BgWhite: '\x1b[47m',

	FgBrightBlack: '\x1b[90m',
	FgBrightRed: '\x1b[91m',
	FgBrightGreen: '\x1b[92m',
	FgBrightYellow: '\x1b[93m',
	FgBrightBlue: '\x1b[94m',
	FgBrightMagenta: '\x1b[95m',
	FgBrightCyan: '\x1b[96m',
	FgBrightWhite: '\x1b[97m',

	BgBrightBlack: '\x1b[100m',
	BgBrightRed: '\x1b[101m',
	BgBrightGreen: '\x1b[102m',
	BgBrightYellow: '\x1b[103m',
	BgBrightBlue: '\x1b[104m',
	BgBrightMagenta: '\x1b[105m',
	BgBrightCyan: '\x1b[106m',
	BgBrightWhite: '\x1b[107m',
} as const;

const version = require('../package.json').version

const defaultProject = ((): string => {
	// process.argv = ['node_path', 'script_path', ...args]
	const lastArg = process.argv.slice(2).slice(-1)[0];

	if (lastArg && !lastArg.startsWith('-')) {
		return lastArg;
	}

	return 'tsconfig.json'
})();

const program = new Command();

program
	.option('-w, --watch', 'Watch input files.')
	.option('-b, --build', 'Build one or more projects and their dependencies, if out of date')
	.option('-p , --project <path>', "FILE OR DIRECTORY Compile the project given the path to its configuration file, or to a folder with a 'tsconfig.json'", defaultProject)
	.version(version, '-v, --version')

program.parse(process.argv);

// @ts-ignore
const options: CliOptions = program.opts();

async function get_config(): Promise<Config> {
	const cwd = process.cwd();

	const ts_config = get_ts_config(cwd, options.project);

	const explorer = cosmiconfig('tscp');
	const result = await explorer.search(cwd);

	const { config: project_config } = result || {};

	const default_config = {
		cwd,
		cli_options: options,
		compiled_files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
		ignored_files: ['node_modules'],
		ts_config,
	};

	const config = {
		...default_config,
		...project_config,
	};

	config.ignored_files = [...config.compiled_files, ...config.ignored_files];

	return config;
}

function get_ts_config(currentDir: string, project: string) {
	const configFile = ts.findConfigFile(currentDir, ts.sys.fileExists, project);

	if (!configFile) throw Error('tsconfig.json not found')

	const { config } = ts.readConfigFile(configFile, ts.sys.readFile);

	return ts.parseJsonConfigFileContent(config, ts.sys, currentDir);
}

function build_project_path(cwd: string, project_path: string, ts_config: ParsedCommandLine): TsProject {
	const currentDirName = path.basename(path.resolve());
	const referenceName = path.relative(process.cwd(), cwd);
	const projectName = path.join(currentDirName, referenceName);

	const { rootDir, outDir } = ts_config.options;

	if (!rootDir) {
		throw new Error(`No 'rootDir' configured in reference '${referenceName}'`)
	}

	if (!outDir) {
		throw new Error(`No 'outDir' configured in reference '${referenceName}'`)
	}

	return {
		project_name: projectName,
		base_path: cwd,
		ts_config_path: project_path,
		root_dir: rootDir,
		out_dir: outDir,
	};
}

function get_ts_project_paths(options: Config): TsProject {
	const { cwd, cli_options, ts_config } = options;

	return build_project_path(cwd, cli_options.project, ts_config);
}

function get_ts_projects_paths(options: Config): TsProject[] {
	const { ts_config } = options;

	if (!ts_config.projectReferences) {
		throw new Error('No project references configured');
	}

	return ts_config.projectReferences.map((reference) => {
		if (!reference.path) {
			throw new Error('Could not find project reference path')
		}

		if (!reference.originalPath) {
			throw new Error('Could not find project reference originalPath')
		}

		const cwd = path.dirname(reference.path);

		const referenceConfig = get_ts_config(cwd, reference.originalPath!);

		return build_project_path(cwd, reference.originalPath!, referenceConfig);
	});
}

function color_log(msg: string, color: typeof console_colors[keyof typeof console_colors]): string {
	return `${color}${msg}${console_colors.Reset}`;
}

/**
 * Makes sure that the given folder exists - creates if not
 * @param path {string}
 */
async function validate_path(path: string): Promise<void> {
	if (!await promisified.fs.exists(path)) {
		await promisified.fs.mkdir(path, { recursive: true });
	}
}

/**
 * Error-safe `fs.lstat` - returns stats if the file exists, otherwise null
 * @param file_path
 */
async function get_file_stats(file_path: string): Promise<fs.Stats | void> {
	try {
		return await promisified.fse.lstat(file_path);
	} catch (e) {
		return Promise.resolve();
	}
}

/**
 *
 * @param file_path
 */
async function remove_file_or_directory(file_path: string): Promise<void> {
	const stats = await get_file_stats(file_path);

	if (!stats) {
		return Promise.resolve();
	}

	// console.log('DELETE', file_path);

	return promisified.rimraf(file_path);
}

async function copy_file_or_directory(source_path: string, destination_path: string) {
	const stats = await get_file_stats(source_path);

	if (!stats) {
		return;
	}

	const is_directory = stats.isDirectory();

	if (is_directory) {
		return promisified.fs.mkdir(destination_path);
	}

	// console.log('COPY', link_target, 'to', link_path);

	return fse.copy(source_path, destination_path);
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export {
	get_config,
	get_ts_config,
	get_ts_project_paths,
	get_ts_projects_paths,
	validate_path,
	get_file_stats,
	remove_file_or_directory,
	copy_file_or_directory,
	sleep,
	promisified,
	console_colors,
	color_log,
};
