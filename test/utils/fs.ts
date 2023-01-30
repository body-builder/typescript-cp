import * as fs from 'fs';
import * as path from 'path';
import rimraf from 'rimraf';
import { validate_path } from '../../src/helpers';

type FileDescriptor = {
	filePath: string;
	fileData: Buffer;
}

type FolderContent = FileDescriptor[];

// https://stackoverflow.com/a/45130990/3111787
export async function getFileList(dir: string) {
	const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
	const files = await Promise.all(dirents.map((dirent) => {
		const res = path.resolve(dir, dirent.name);
		return dirent.isDirectory() ? getFileList(res) : res;
	}));
	return Array.prototype.concat(...files) as string[];
}

export async function readFolderContent(dir: string): Promise<FolderContent> {
	const files = await getFileList(dir);
	return await Promise.all(files.map(async (filePath) => {
		const fileData = await fs.promises.readFile(filePath);

		return {
			filePath,
			fileData,
		};
	}));
}

export async function restoreFolderContent(dir: string, files: FolderContent) {
	rimraf.sync(dir);

	return await Promise.all(files.map(async ({ filePath, fileData }) => {
		await validate_path(filePath);

		return fs.promises.writeFile(filePath, fileData);
	}));
}
