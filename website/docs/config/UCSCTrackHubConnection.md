---
id: ucsctrackhubconnection
title: UCSCTrackHubConnection
sidebar_label: Connection -> UCSCTrackHubConnection
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/UCSCTrackHubConnection/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/UCSCTrackHubConnection.md)

## Overview

### UCSCTrackHubConnection - Pre-processor / simplified config

preprocessor to allow minimal config, where `uri` points at the hub.txt:

```json
{
  "type": "UCSCTrackHubConnection",
  "uri": "https://mysite.com/path/to/hub.txt"
}
```

<details open>
<summary>UCSCTrackHubConnection - Slots</summary>

#### slot: hubTxtLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: 'https://mysite.com/path/to/hub.txt',
    locationType: 'UriLocation',
  },
  description: 'location of the hub file (usually called hub.txt)',
}
```

#### slot: assemblyNames

```js
{
  type: 'stringArray',
  defaultValue: [],
  description:
    'optional list of genomes to import from this track hub, if empty all genomes will be imported',
}
```

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

<details open>
<summary>Inherited from BaseConnection</summary>

[BaseConnection config →](../baseconnection)

#### slot: name

```js
{
  type: 'string',
  defaultValue: 'nameOfConnection',
  description: 'a unique name for this connection',
}
```

#### slot: assemblyNames

```js
{
  type: 'stringArray',
  defaultValue: [],
  description: 'optional list of names of assemblies in this connection',
}
```

</details>

### UCSCTrackHubConnection - Derives from

- [BaseConnection](../baseconnection)

```js
baseConfiguration: baseConnectionConfig
```
