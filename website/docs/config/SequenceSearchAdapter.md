---
id: sequencesearchadapter
title: SequenceSearchAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/SequenceSearchAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/SequenceSearchAdapter.md)

## Docs

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
