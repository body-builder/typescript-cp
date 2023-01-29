import * as process from 'process';
import { describe, expect, it } from 'vitest';
import {  getDefaultProject } from '../src/helpers';

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
});
