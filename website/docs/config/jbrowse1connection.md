---
id: jbrowse1connection
title: JBrowse1Connection
toplevel: true
---

#### slot: dataDirLocation
```js

    /**
     * !slot
     */
    dataDirLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'http://mysite.com/jbrowse/data/',
        locationType: 'UriLocation',
      },
      description:
        'the location of the JBrowse 1 data directory, often something like http://mysite.com/jbrowse/data/',
    }
```
#### slot: assemblyNames
```js

    /**
     * !slot
     */
    assemblyNames: {
      description:
        'name of the assembly the connection belongs to, should be a single entry',
      type: 'stringArray',
      defaultValue: [],
    }
```
#### derives from: 
```js

    /**
     * !baseConfiguration
     */
    baseConfiguration: baseConnectionConfig
```
#### slot: namesIndexLocation
```js

    /**
     * !slot
     */
    namesIndexLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/volvox/names', locationType: 'UriLocation' },
      description: 'the location of the JBrowse1 names index data directory',
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
