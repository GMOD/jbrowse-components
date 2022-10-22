---
id: trixtextsearchadapter
title: TrixTextSearchAdapter
toplevel: true
---

### Slots

#### slot: ixFilePath

```js
ixFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: 'out.ix', locationType: 'UriLocation' },
      description: 'the location of the trix ix file',
    }
```

#### slot: ixxFilePath

```js
ixxFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: 'out.ixx', locationType: 'UriLocation' },
      description: 'the location of the trix ixx file',
    }
```

#### slot: metaFilePath

```js
metaFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: 'meta.json', locationType: 'UriLocation' },
      description: 'the location of the metadata json file for the trix index',
    }
```

#### slot: tracks

```js
tracks: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of tracks covered by text search adapter',
    }
```

#### slot: assemblyNames

```js
assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
    }
```
