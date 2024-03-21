---
id: multiwiggleadapter
title: MultiWiggleAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/wiggle/src/MultiWiggleAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiWiggleAdapter/configSchema.ts)

### MultiWiggleAdapter - Slots

#### slot: bigWigs

```js
bigWigs: {
      defaultValue: [],
      description:
        'array of bigwig filenames, alternative to the subadapters slot',
      type: 'frozen',
    }
```

#### slot: subadapters

```js
subadapters: {
      defaultValue: [],
      description: 'array of subadapter JSON objects',
      type: 'frozen',
    }
```
