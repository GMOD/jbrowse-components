---
id: multiwiggleadapter
title: MultiWiggleAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiWiggleAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/MultiWiggleAdapter.md)

## Docs

### MultiWiggleAdapter - Slots

#### slot: subadapters

```js
subadapters: {
      type: 'frozen',
      defaultValue: [],
      description: 'array of subadapter JSON objects',
    }
```

#### slot: bigWigs

```js
bigWigs: {
      type: 'frozen',
      description:
        'array of bigwig filenames, alternative to the subadapters slot',
      defaultValue: [],
    }
```
