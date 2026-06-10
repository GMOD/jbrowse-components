---
id: maftabixadapter
title: MafTabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/MafTabixAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/MafTabixAdapter.md)

## Overview

### MafTabixAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes tbi index at yourfile.bed.gz.tbi:

```json
{
  "type": "MafTabixAdapter",
  "uri": "yourfile.bed.gz",
  "samples": ["sample1", "sample2"]
}
```

### MafTabixAdapter - Slots

#### slot: samples

```js
samples: {
      type: 'frozen',
      description: 'string[] or {id:string,label:string,color?:string}[]',
      defaultValue: [],
    }
```

#### slot: bedGzLocation

```js
bedGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bed.gz',
        locationType: 'UriLocation',
      },
    }
```

#### slot: refAssemblyName

```js
refAssemblyName: {
      type: 'string',
      defaultValue: '',
    }
```

#### slot: index.location

```js
location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.bed.gz.tbi',
        },
      }
```

#### slot: index.indexType

```js
indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      }
```

#### slot: nhLocation

```js
nhLocation: {
      type: 'fileLocation',
      description: 'newick tree',
      defaultValue: {
        uri: '/path/to/my.nh',
        locationType: 'UriLocation',
      },
    }
```
