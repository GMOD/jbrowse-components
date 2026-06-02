---
id: ucsctrackhubconnection
title: UCSCTrackHubConnection
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/UCSCTrackHubConnection/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/UCSCTrackHubConnection.md)

## Docs

### UCSCTrackHubConnection - Pre-processor / simplified config

preprocessor to allow minimal config, where `uri` points at the hub.txt:

```json
{
  "type": "UCSCTrackHubConnection",
  "uri": "http://mysite.com/path/to/hub.txt"
}
```

### UCSCTrackHubConnection - Slots

#### slot: hubTxtLocation

```js
hubTxtLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'http://mysite.com/path/to/hub.txt',
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

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

### Inherited from [BaseConnection](../baseconnection)

#### slot: name

```js
name: {
      type: 'string',
      defaultValue: 'nameOfConnection',
      description: 'a unique name for this connection',
    }
```

#### slot: assemblyNames

```js
assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'optional list of names of assemblies in this connection',
    }
```

### UCSCTrackHubConnection - Derives from

- [BaseConnection](../baseconnection)

```js
baseConfiguration: baseConnectionConfig
```
