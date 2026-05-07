---
id: refnamealiasadapter
title: RefNameAliasAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/RefNameAliasAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/RefNameAliasAdapter.md)

## Docs

can read "chromAliases" type files from UCSC or any tab separated file of
refName aliases

### RefNameAliasAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "RefNameAliasAdapter",
  "uri": "yourfile.chromAlias.txt"
}
```

### RefNameAliasAdapter - Slots

#### slot: location

```js
location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/aliases.txt',
        locationType: 'UriLocation',
      },
    }
```

#### slot: refNameColumn

by default, the "ref names that match the fasta" are assumed to be in the first
column (0), change this variable if needed

```js
refNameColumn: {
      type: 'number',
      defaultValue: 0,
    }
```

#### slot: refNameColumnHeaderName

refNameColumnHeaderName

```js
refNameColumnHeaderName: {
      type: 'string',
      description:
        'alternative to refNameColumn, instead looks at header (starts with # and finds column name)',
      defaultValue: '',
    }
```
