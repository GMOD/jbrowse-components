---
id: nclistadapter
title: NCListAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/NCListAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/NCListAdapter.md)

## Docs

### NCListAdapter - Slots

#### slot: rootUrlTemplate

```js
rootUrlTemplate: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/{refseq}/trackData.json',
        locationType: 'UriLocation',
      },
    }
```

#### slot: refNames

```js
refNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of refNames used by the NCList used for aliasing',
    }
```
