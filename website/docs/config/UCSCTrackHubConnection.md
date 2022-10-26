---
id: ucsctrackhubconnection
title: UCSCTrackHubConnection
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Understanding the configuration
model](/docs/devguide_config/) and [Config guide](/docs/config_guide) for more
info

### UCSCTrackHubConnection - Slots

#### slot: hubTxtLocation

```js
hubTxtLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'http:
        locationType: 'UriLocation',
      },
      description: 'location of the hub file (usually called hub.txt)',
    }
```

#### slot: assemblyNames

```js
assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'optional list of genomes to import from this track hub, if empty all genomes will be imported',
    }
```

## UCSCTrackHubConnection - Derives from

```js
baseConfiguration: baseConnectionConfig
```
