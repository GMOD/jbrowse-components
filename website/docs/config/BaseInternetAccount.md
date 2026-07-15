---
id: baseinternetaccount
title: BaseInternetAccount
sidebar_label: Internet Account -> BaseInternetAccount
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/baseInternetAccountConfig.ts).

## Overview

the "base" internet account type

### BaseInternetAccount - Identifier

Every BaseInternetAccount has a unique `internetAccountId`, a required top-level
field that identifies it (not one of the config slots below).

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                             | Type          | Description                                                    |
| -------------------------------- | ------------- | -------------------------------------------------------------- |
| [name](#slot-name)               | `string`      | descriptive name of the internet account                       |
| [description](#slot-description) | `string`      | a description of the internet account                          |
| [authHeader](#slot-authheader)   | `string`      | request header for credentials                                 |
| [tokenType](#slot-tokentype)     | `string`      | a custom name for a token to include in the header             |
| [domains](#slot-domains)         | `stringArray` | array of valid domains the url can contain to use this account |

<details>
<summary>BaseInternetAccount - Slots</summary>

#### slot: name

descriptive name of the internet account

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: description

a description of the internet account

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: authHeader

request header for credentials

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'Authorization'`

#### slot: tokenType

a custom name for a token to include in the header

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: domains

array of valid domains the url can contain to use this account

**Type:** `stringArray` · **Default:** `[]`

</details>
