# Typescript-cp

[![npm version](https://badge.fury.io/js/typescript-cp.svg)](http://badge.fury.io/js/typescript-cp)
[![dependencies Status](https://david-dm.org/body-builder/typescript-cp/status.svg)](https://david-dm.org/body-builder/typescript-cp)
[![devDependencies Status](https://david-dm.org/body-builder/typescript-cp/dev-status.svg)](https://david-dm.org/body-builder/typescript-cp?type=dev)
[![peerDependencies Status](https://david-dm.org/body-builder/typescript-cp/peer-status.svg)](https://david-dm.org/body-builder/typescript-cp?type=peer)

Copy non-typescript files to outDir

## Installation

`$ npm install typescript-cp -D`

## CLI

```shell
# Copy
$ tscp

# Copy for TS project references
$ tscp -b

# Watcher
$ tscp -w

# Watcher for TS project references
$ tscp -b -w

# Custom compiler settings
$ tscp -p tsconfig.production.json

# Help
$ tscp -h
```

## Example

package.json
```json5
{
  //...
  "scripts": {
    "start": "tsc -w & tscp -w",
    "build": "tsc && tscp"
  },
  //...
}
```

# Configuration
.tscprc
```json5
{
  "ignored_files": ['**/an_ignored_file.ext'], // files not to copy (defaults to `['node_modules']`)
  "compiled_files": [], // files compiled by TS (these also get ignored) (defaults to `['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']`)
  "use_ts_exclude": true, // ignore files that are listed in the tsconfig `exclude` array (defaults to `true`)
}
```

# Loaders

You can attach basic loader rules to the files. Loaders accept the actual content of the given file as the first parameter, and must return the content of the output file.

.tscprc.js
```js
const path = require('path');

/**
 * @type {import('typescript-cp/dist/types').Config}
 */
module.exports = {
  rules: [
    {
      test: /\.(scss|sass)$/,
      include: [
        path.resolve('./file-to-include.css'),
      ],
      exclude: (source_path) => {
        return source_path.indexOf('file-to-include.sass') > -1;
      },
      use: [
        {
          loader: (content, meta) => {
            // Do something with `content`

            return content;
          },
        },
      ],
    },
  ],
};
```

See `Config` and `Rule` types in `src/types.ts` for the complete reference.


## Contribution

`$ npm run build`

----

Sponsored by: [SRG Group Kft.](https://srg.hu?en)
