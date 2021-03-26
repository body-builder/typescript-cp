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
  "ignored_files": ['**/an_ignored_file.ext'], // files not to copy (defaults to ['node_modules'])
  "compiled_files": [] // files compiled by TS (these also get ignored) (defaults to ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'])
}
```


## Contribution

`$ npm run build`

----

Sponsored by: [SRG Group Kft.](https://srg.hu?en)
