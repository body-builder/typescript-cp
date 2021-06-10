#!/usr/bin/env node

import { copy_files, watch_files } from '../actions';
import { color_log, console_colors, get_config, get_ts_project_paths, get_ts_projects_paths } from '../helpers';

async function command() {
	const config = await get_config();

	const { cli_options } = config;

	const projects = cli_options.build ? get_ts_projects_paths(config) : [get_ts_project_paths(config)];

	if (cli_options.watch) {
		return watch_files(projects, config)
			.then(() => {
				if (projects) {
					console.log('Starting the non-typescript file watcher...');
				} else {
					console.log('No non-typescript files found to watch')
				}
			})
			.catch((e) => {
				console.error('Something went wrong during watching the non-typescript files', '\n', e);
			});
	}

	return copy_files(projects, config)
		.then(() => {
			if (projects) {
				console.log('Non-typescript files copied');
				console.log(projects.map(({ project_name }) => `${color_log(project_name, console_colors.FgGreen)}`).join('\n'))
			} else {
				console.log('No non-typescript files found to copy')
			}
		})
		.catch((e) => {
			console.error('Something went wrong during the copy of the non-typescript files', '\n', e);
		});
}

command()
	.then()
	.catch();
