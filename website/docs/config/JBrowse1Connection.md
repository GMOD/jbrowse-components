---
id: jbrowse1connection
title: JBrowse1Connection
sidebar_label: Connection -> JBrowse1Connection
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`legacy-jbrowse` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/JBrowse1Connection/configSchema.ts).

## Overview

### JBrowse1Connection - State model

This config's runtime API is documented on its
[state model page](../../models/jbrowse1connection).

<details open>
<summary>JBrowse1Connection - Slots</summary>

#### slot: dataDirLocation

the location of the JBrowse 1 data directory, often something like
https://mysite.com/jbrowse/data/

**Type:** `fileLocation` · **Default:**
`{ uri: 'https://mysite.com/jbrowse/data/', locationType: 'UriLocation' }`

#### slot: assemblyNames

name of the assembly the connection belongs to, should be a single entry

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

### JBrowse1Connection - Derives from

- [BaseConnection](../baseconnection)
