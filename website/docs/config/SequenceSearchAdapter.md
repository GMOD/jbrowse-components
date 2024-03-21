---
id: sequencesearchadapter
title: SequenceSearchAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/sequence/src/SequenceSearchAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/SequenceSearchAdapter/configSchema.ts)

### SequenceSearchAdapter - Slots

#### slot: caseInsensitive

```js
caseInsensitive: {
      defaultValue: true,
      type: 'boolean',
    }
```

#### slot: search

```js
search: {
      defaultValue: '',
      description: 'Search string or regex to search for',
      type: 'string',
    }
```

#### slot: searchForward

```js
searchForward: {
      defaultValue: true,
      type: 'boolean',
    }
```

#### slot: searchReverse

```js
searchReverse: {
      defaultValue: true,
      type: 'boolean',
    }
```

#### slot: sequenceAdapter

```js
sequenceAdapter: {
      defaultValue: null,
      type: 'frozen',
    }
```
