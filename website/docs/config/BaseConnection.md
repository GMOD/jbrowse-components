---
id: baseconnection
title: BaseConnection
sidebar_label: Connection -> BaseConnection
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/baseConnectionConfig.ts).

## Overview

### BaseConnection - Identifier

Every BaseConnection has a unique `connectionId`, a required top-level field
that identifies it (not one of the config slots below).

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                 | Type          | Description                                             |
| ------------------------------------ | ------------- | ------------------------------------------------------- |
| [name](#slot-name)                   | `string`      | a unique name for this connection                       |
| [assemblyNames](#slot-assemblynames) | `stringArray` | optional list of names of assemblies in this connection |

<details>
<summary>BaseConnection - Slots</summary>

#### slot: name

a unique name for this connection

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'nameOfConnection'`

#### slot: assemblyNames

optional list of names of assemblies in this connection

**Type:** `stringArray` · **Default:** `[]`

</details>
