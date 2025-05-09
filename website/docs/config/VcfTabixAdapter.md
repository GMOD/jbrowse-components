---
id: vcftabixadapter
title: VcfTabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VcfTabixAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/VcfTabixAdapter.md)

## Docs

### VcfTabixAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes tbi index at yourfile.vcf.gz.tbi:

```json
{
  "type": "VcfTabixAdapter",
  "uri": "yourfile.vcf.gz"
}
```

### VcfTabixAdapter - Slots

#### slot: vcfGzLocation

```js
vcfGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.vcf.gz',
        locationType: 'UriLocation',
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

#### slot: index.location

```js
location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.vcf.gz.tbi',
          locationType: 'UriLocation',
        },
      }
```

#### slot: samplesTsvLocation

```js
samplesTsvLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/samples.tsv',
        description:
          'tsv with header like name\tpopulation\tetc. where the first column is required, and is the sample names',
        locationType: 'UriLocation',
      },
    }
```
