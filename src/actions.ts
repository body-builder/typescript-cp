import * as path from 'path';
import globby from 'globby';
import chokidar from 'chokidar';
import {
	color_log,
	console_colors,
	copy_file_or_directory,
	definitely_posix,
	get_ignore_list,
	remove_file_or_directory,
	sleep,
} from './helpers';
import { Config, TsProject, TsProjectWithFiles } from './types';

/**
 * Returns an extended TsProject array, containing also the paths of all files in the project that will be processed
 * @param projects
 * @param config
 */
export async function collect_projects_files(projects: TsProject[], config: Config): Promise<TsProjectWithFiles[]> {
	// console.log('collect_projects_files');
	if (!Array.isArray(projects)) {
		throw new Error('No project data received');
	}

	return Promise.all(projects.map(async (project): Promise<TsProjectWithFiles> => {
		const source_files = await globby('**/*', {
			cwd: project.root_dir,
			dot: true,
			onlyFiles: true,
			ignore: get_ignore_list(config, project),
		});

		return {
			...project,
			source_files,
		}
	}));
}

/**
 * Returns a flat array with the source and target paths of all files that will be processed
 * @param globed_projects
 */
export async function collect_projects_files_flat(globed_projects: TsProjectWithFiles[]): Promise<{ source_path: string; target_path: string; }[]> {
	const all_projects_files = await Promise.all(globed_projects.map(async (project) => {
		const { root_dir, out_dir, source_files } = project;

		return await Promise.all(source_files.map(async (file) => {
			const source_path = path.resolve(root_dir, file); // The path to the source file
			const target_path = path.resolve(out_dir, file); // The path to the file in the outDir

			return { source_path, target_path };
		}));
	}));

	return all_projects_files.flat();
}

/**
 * Copies all files from the source path to the output path
 * @param projects
 * @param config
 */
export async function copy_files(projects: TsProject[], config: Config): Promise<void> {
	// console.log('copy_projects');
	const globed_projects = await collect_projects_files(projects, config);

	const all_projects_files = await collect_projects_files_flat(globed_projects);

	// Delete files
	// we should do this in two steps, to avoid possible deletion of already linked files (when a folder gets )
	await Promise.all(all_projects_files.map(async ({ source_path, target_path }) => {
		return remove_file_or_directory(target_path);
	}));

	// Link files
	await Promise.all(all_projects_files.map(async ({ source_path, target_path }) => {
		return copy_file_or_directory(source_path, target_path, config);
	}));
}

/**
 * Starts a watcher listening to the changes in the source path and synchronizing them to the output path
 * @param projects
 * @param config
 */
export async function watch_files(projects: TsProject[], config: Config): Promise<void> {
	// console.log('watch_projects');
	const globed_projects = await collect_projects_files(projects, config);

	const files_to_watch = globed_projects.map(({ root_dir }) => `${root_dir}/.`);
	const ignore_glob = `{${get_ignore_list(config, projects).map((rule) => {
		if (!rule.startsWith('**/')) {
			return `**/${rule}`;
		}

		return rule;
	}).join(',')}}`;

	const watcher = chokidar.watch(files_to_watch, {
		ignored: ignore_glob,
	});

	/**
	 * Find the TS project the requested file belongs to
	 * @param source_path
	 */
	function get_target_path(source_path: string): { project_name: string; filename: string; source_path: string; target_path: string; } {
		const parent_project = globed_projects.find(({ base_path }) => source_path.startsWith(base_path));

		if (!parent_project) {
			throw new Error(`Could not find the TS project to which the file belongs to: '${source_path}'`);
		}

		const filename = path.relative(parent_project.root_dir, source_path);
		const target_path = path.resolve(parent_project.out_dir, filename);

		return {
			project_name: parent_project.project_name,
			source_path,
			filename,
			target_path,
		};
	}

	async function watch_idle_log(msg: string = 'Watching files for changes', timeout: number = 1000, clear: boolean = true): Promise<void> {
		await sleep(1000);
		if (clear) {
			console.clear();
		}
		console.log(msg);
		console.log(color_log(globed_projects.map(({ project_name }) => `${project_name}`).join('\n'), console_colors.FgBrightBlack))
	}

	let isReady = false;

	async function close_watcher(): Promise<void> {
		await watcher.close();
		console.log('\nFile watcher gracefully shut down.');
	}

	watcher
		.on('ready', async () => {
			await watch_idle_log();
			isReady = true;
		})
		.on('add', async (unsafe_source_path) => {
			const source_path = definitely_posix(unsafe_source_path);
			const { target_path, project_name, filename } = get_target_path(source_path);
			await copy_file_or_directory(unsafe_source_path, target_path, config);
			// Do not pollute the console with the bootstrapping data
			if (isReady) {
				console.log(color_log(`${project_name}/${filename}`, console_colors.FgGreen), 'added');
				await watch_idle_log();
			}
		})
		.on('change', async (unsafe_source_path) => {
			const source_path = definitely_posix(unsafe_source_path);
			const { target_path, project_name, filename } = get_target_path(source_path);
			await copy_file_or_directory(source_path, target_path, config);
			console.log(color_log(`${project_name}/${filename}`, console_colors.FgYellow), 'changed');
			await watch_idle_log();
		})
		.on('unlink', async (unsafe_source_path) => {
			const source_path = definitely_posix(unsafe_source_path);
			const { target_path, project_name, filename } = get_target_path(source_path);
			await remove_file_or_directory(target_path);
			console.log(color_log(`${project_name}/${filename}`, console_colors.FgRed), 'deleted');
			await watch_idle_log();
		});

	process
		.on('SIGINT', async () => {
			// console.log('SIGINT, closing watcher');
			await close_watcher();
		})
		.on('SIGTERM', async () => {
			// console.log('SIGTERM, closing watcher');
			await close_watcher();
		});
}
