---
id: blasttabularadapter
title: BlastTabularAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/BlastTabularAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BlastTabularAdapter.md)

## Docs

### BlastTabularAdapter - Slots

#### slot: assemblyNames

```js
assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Query assembly is the first value in the array, target assembly is the second',
    }
```

#### slot: targetAssembly

```js
targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the target assembly',
    }
```

#### slot: queryAssembly

```js
queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the query assembly',
    }
```

#### slot: blastTableLocation

```js
blastTableLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/blastTable.tsv',
        locationType: 'UriLocation',
      },
    }
```

#### slot: columns

```js
columns: {
      type: 'string',
      description:
        'Optional space-separated column name list. If custom columns were used in outfmt, enter them here exactly as specified in the command. At least qseqid, sseqid, qstart, qend, sstart, and send are required',
      defaultValue:
        'qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore',
    }
```
