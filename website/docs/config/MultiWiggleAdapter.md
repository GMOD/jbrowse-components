---
id: multiwiggleadapter
title: MultiWiggleAdapter
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Understanding the configuration
model](/docs/devguide_config/) and [Config guide](/docs/config_guide) for more
info

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
