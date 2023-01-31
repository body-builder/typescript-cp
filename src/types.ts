import { ParsedCommandLine } from 'typescript';

export type CliOptions = {
	watch?: boolean;
	build?: boolean;
	project: string;
}

export type Config = {
	/**
	 * The path the process was started from
	 */
	cwd: string;

	/**
	 * Config coming from `process.arg`
	 */
	cli_options: CliOptions,

	/**
	 * The complete tsconfig object
	 */
	ts_config: ParsedCommandLine,

	/**
	 * Ignore files that are listed in the tsconfig `exclude` array
	 * Defaults to `true`
	 */
	use_ts_exclude: boolean;

	/**
	 * Files compiled by TS (these also get ignored)
	 * Defaults to `['** /*.ts', '** /*.tsx', '** /*.js', '** /*.jsx']`
	 */
	compiled_files: string[];

	/**
	 * Files not to copy
	 * Defaults to `['node_modules']`
	 */
	ignored_files: string[];

	/**
	 * Set of loader rules to preprocess the file content before copying
	 */
	rules: Rule[];
}

export type Rule = {
	test?: RuleCondition;
	include?: RuleCondition;
	exclude?: RuleCondition;
	use: Loader[];
	// TODO This hasn't been implemented yet.
	options?: { [key: string]: any }
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

export type Loader = {
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

export type TsProject = {
	project_name: string;
	base_path: string;
	ts_config_path: string;
	root_dir: string;
	out_dir: string;
	exclude: string[];
}

export type TsProjectWithFiles = TsProject & {
	source_files: string[];
}
