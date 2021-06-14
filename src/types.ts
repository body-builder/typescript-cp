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
	test?: RuleCondition;
	include?: RuleCondition;
	exclude?: RuleCondition;
	use: Loader[];
	options: { [key: string]: any }
}

/**
 * Resource paths always meant to be absolute paths.
 */
export type RuleCondition =
	| RegExp
	| string
	| ((path: string) => boolean)
	| RuleConditions;

export type RuleConditions = RuleCondition[];

export interface Loader {
	/**
	 * A path reference to the loader function, or the loader function itself.
	 */
	loader:
		| string
		| LoaderFunction;
}

/**
 * The loader function accepts the actual content of the given file as the first parameter, and must return the content of the output file.
 */
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
