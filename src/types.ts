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
	rules: Rule[];
}

export interface Rule {
	test: RegExp;
	use: Loader[];
	options: { [key: string]: any }
}
export interface Loader {
	loader: LoaderFunction | string;
}

export type LoaderFunction = (content: string, meta: LoaderMeta) => string;

export type LoaderMeta = {
	source_path: string;
	destination_path: string;
	config: Config;
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
