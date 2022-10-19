---
id: trixtextsearchadapter
title: TrixTextSearchAdapter
toplevel: true
---

#### slot: ixFilePath
```js

    /**
     * !slot
     */
    ixFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: 'out.ix', locationType: 'UriLocation' },
      description: 'the location of the trix ix file',
    }
```
#### slot: ixxFilePath
```js

    /**
     * !slot
     */
    ixxFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: 'out.ixx', locationType: 'UriLocation' },
      description: 'the location of the trix ixx file',
    }
```
#### slot: metaFilePath
```js

    /**
     * !slot
     */
    metaFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: 'meta.json', locationType: 'UriLocation' },
      description: 'the location of the metadata json file for the trix index',
    }
```
#### slot: tracks
```js

    /**
     * !slot
     */
    tracks: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of tracks covered by text search adapter',
    }
```
#### slot: assemblyNames
```js

    /**
     * !slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
    }
```
