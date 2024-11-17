---
id: blasttabularadapter
title: BlastTabularAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/comparative-adapters/src/BlastTabularAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/BlastTabularAdapter/configSchema.ts)

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
