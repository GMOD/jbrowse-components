---
id: plinkldtabixadapter
title: PlinkLDTabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/PlinkLDAdapter/configSchemaTabix.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/PlinkLDTabixAdapter.md)

## Docs

Adapter for reading pre-computed LD data from PLINK --r2 output (tabix-indexed).

The input file should be bgzipped and tabix-indexed: bgzip plink.ld tabix -s1
-b2 -e2 plink.ld.gz

Expected columns: CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2 Optional columns: DP
(D'), MAF_A, MAF_B

### PlinkLDTabixAdapter - Pre-processor / simplified config

Preprocessor to allow minimal config:

```json
{
  "type": "PlinkLDTabixAdapter",
  "uri": "plink.ld.gz"
}
```

### PlinkLDTabixAdapter - Slots

#### slot: ldLocation

Location of the bgzipped PLINK LD file (.ld.gz)

```js
ldLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/plink.ld.gz',
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
          uri: '/path/to/plink.ld.gz.tbi',
          locationType: 'UriLocation',
        },
      }
```
