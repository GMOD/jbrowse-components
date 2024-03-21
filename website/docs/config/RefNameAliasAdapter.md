---
id: refnamealiasadapter
title: RefNameAliasAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/config/src/RefNameAliasAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/RefNameAliasAdapter/configSchema.ts)

can read "chromAliases" type files from UCSC or any tab separated file of
refName aliases

### RefNameAliasAdapter - Slots

#### slot: location

```js
location: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/my/aliases.txt',
      },
      type: 'fileLocation',
    }
```

#### slot: refNameColumn

by default, the "ref names that match the fasta" are assumed to be in the first
column (0), change this variable if needed

```js
refNameColumn: {
      defaultValue: 0,
      type: 'number',
    }
```
