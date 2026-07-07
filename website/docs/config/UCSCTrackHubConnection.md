---
id: ucsctrackhubconnection
title: UCSCTrackHubConnection
sidebar_label: Connection -> UCSCTrackHubConnection
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/UCSCTrackHubConnection/configSchema.ts).

## Overview

### UCSCTrackHubConnection - State model

This config's runtime API is documented on its
[state model page](../../models/ucsctrackhubconnection).

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

location of the hub file (usually called hub.txt)

**Type:** `fileLocation`

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

optional list of genomes to import from this track hub, if empty all genomes
will be imported

**Type:** `stringArray` · **Default:** `[]`

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details open>
<summary>Inherited from BaseConnection</summary>

[BaseConnection config →](../baseconnection)

#### slot: name

a unique name for this connection

**Type:** `string` · **Default:** `'nameOfConnection'`

</details>

### UCSCTrackHubConnection - Derives from

- [BaseConnection](../baseconnection)
