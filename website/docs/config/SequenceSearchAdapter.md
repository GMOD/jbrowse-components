---
id: sequencesearchadapter
title: SequenceSearchAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/sequence/src/SequenceSearchAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/SequenceSearchAdapter/configSchema.ts)

### SequenceSearchAdapter - Slots

#### slot: search

```js
search: {
      type: 'string',
      defaultValue: '',
      description: 'Search string or regex to search for',
    }
```

#### slot: sequenceAdapter

```js
sequenceAdapter: {
      type: 'frozen',
      defaultValue: null,
    }
```

#### slot: searchForward

```js
searchForward: {
      type: 'boolean',
      defaultValue: true,
    }
```

#### slot: searchReverse

```js
searchReverse: {
      type: 'boolean',
      defaultValue: true,
    }
```

#### slot: caseInsensitive

```js
caseInsensitive: {
      type: 'boolean',
      defaultValue: true,
    }
```
