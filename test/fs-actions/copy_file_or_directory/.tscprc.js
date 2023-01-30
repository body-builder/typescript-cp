/**
 * @type {import('../../../src/types').Config}}
 */
module.exports = {
	rules: [
		{
			test: /\.s(a|ac)ss$/,
			use: [
				{
					loader: (content) => content.replace('loader 2', 'loader 1 + 2'),
				},
				{
					loader: (content) => content + '/* loader 2 */\n',
				},
			],
		},
	],
};
