---
id: nclistadapter
title: NCListAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/legacy-jbrowse/src/NCListAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/NCListAdapter/configSchema.ts)

### NCListAdapter - Slots

#### slot: refNames

```js
refNames: {
      defaultValue: [],
      description: 'List of refNames used by the NCList used for aliasing',
      type: 'stringArray',
    }
```

#### slot: rootUrlTemplate

```js
rootUrlTemplate: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/my/{refseq}/trackData.json',
      },
      type: 'fileLocation',
    }
```
