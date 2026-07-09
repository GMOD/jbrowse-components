---
id: jbrowse1connection
title: JBrowse1Connection
sidebar_label: Connection -> JBrowse1Connection
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`legacy-jbrowse` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/JBrowse1Connection/configSchema.ts).

## Related links

- **State model:** [runtime API](../../models/jbrowse1connection)
- **Base config:** [BaseConnection](../baseconnection)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                     | Type           | Description                                                                                         |
| ---------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------- |
| [dataDirLocation](#slot-datadirlocation) | `fileLocation` | the location of the JBrowse 1 data directory, often something like https://mysite.com/jbrowse/data/ |
| [assemblyNames](#slot-assemblynames)     | `stringArray`  | name of the assembly the connection belongs to, should be a single entry                            |

<details>
<summary>JBrowse1Connection - Slots</summary>

#### slot: dataDirLocation

the location of the JBrowse 1 data directory, often something like
https://mysite.com/jbrowse/data/

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:**
`{ uri: 'https://mysite.com/jbrowse/data/', locationType: 'UriLocation' }`

#### slot: assemblyNames

name of the assembly the connection belongs to, should be a single entry

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
