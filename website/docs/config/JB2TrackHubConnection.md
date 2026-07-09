---
id: jb2trackhubconnection
title: JB2TrackHubConnection
sidebar_label: Connection -> JB2TrackHubConnection
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`data-management` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/JB2TrackHubConnection/configSchema.ts).

## Overview

### JB2TrackHubConnection - Pre-processor / simplified config

preprocessor to allow minimal config, where `uri` points at the jb2 config.json:

```json
{
  "type": "JB2TrackHubConnection",
  "uri": "https://mysite.com/path/to/config.json"
}
```

## Related links

- **State model:** [runtime API](../../models/jb2trackhubconnection)
- **Base config:** [BaseConnection](../baseconnection)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                           | Type           | Description                                                                                     |
| ---------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------- |
| [configJsonLocation](#slot-configjsonlocation) | `fileLocation` | location of the jb2 config file (usually called config.json)                                    |
| [assemblyNames](#slot-assemblynames)           | `stringArray`  | optional list of genomes to import from this config.json, if empty all genomes will be imported |

<details>
<summary>JB2TrackHubConnection - Slots</summary>

#### slot: configJsonLocation

location of the jb2 config file (usually called config.json)

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation)

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: 'https://mysite.com/path/to/config.json',
    locationType: 'UriLocation',
  },
  description:
    'location of the jb2 config file (usually called config.json)',
}
```

#### slot: assemblyNames

optional list of genomes to import from this config.json, if empty all genomes
will be imported

**Type:** `stringArray` · **Default:** `[]`

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details>
<summary>Inherited from BaseConnection</summary>

[BaseConnection config →](../baseconnection)

#### slot: name

a unique name for this connection

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'nameOfConnection'`

</details>
