import { ParsedCommandLine } from 'typescript';

export interface CliOptions {
	watch?: boolean;
	build?: boolean;
	project: string;
}

export interface Config {
	cwd: string;
	cli_options: CliOptions,
	ts_config: ParsedCommandLine,
	compiled_files: string[];
	ignored_files: string[];
}

export interface TsProject {
	project_name: string;
	base_path: string;
	ts_config_path: string;
	root_dir: string;
	out_dir: string;
}

export interface TsProjectWithFiles extends TsProject {
	source_files: string[];
}
