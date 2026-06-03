---
id: gff3tabixadapter
title: Gff3TabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gff3/src/Gff3TabixAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/Gff3TabixAdapter.md)

## Docs

used to load bgzip-compressed, tabix-indexed GFF3 files

## Example usage

The `uri` shorthand auto-resolves the `.tbi` index; add `csi: true` for a `.csi`
index instead:

```js
{
  type: 'Gff3TabixAdapter',
  uri: 'https://example.com/genes.gff3.gz',
}
```

### Gff3TabixAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes tbi index at yourfile.gff3.gz.tbi
(or .csi if csi:true):

```json
{
  "type": "Gff3TabixAdapter",
  "uri": "yourfile.gff3.gz",
  "csi": true
}
```

### Gff3TabixAdapter - Slots

#### slot: gffGzLocation

```js
gffGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.gff.gz',
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

#### slot: index.indexType

```js
location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.gff.gz.tbi',
          locationType: 'UriLocation',
        },
      }
```

#### slot: dontRedispatch

the Gff3TabixAdapter has to "redispatch" if it fetches a region and features it
finds inside that region extend outside the region we requested. you can disable
this for certain feature types to avoid fetching e.g. the entire chromosome

```js
dontRedispatch: {
      type: 'stringArray',
      defaultValue: ['chromosome', 'region', 'contig'],
    }
```
