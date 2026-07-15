---
id: externaltokeninternetaccount
title: ExternalTokenInternetAccount
sidebar_label: Internet Account -> ExternalTokenInternetAccount
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/ExternalTokenModel/configSchema.ts).

## Related links

- **State model:** [runtime API](../../models/externaltokeninternetaccount)
- **Base config:** [BaseInternetAccount](../baseinternetaccount)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                       | Type      | Description                                            |
| ------------------------------------------ | --------- | ------------------------------------------------------ |
| [validateWithHEAD](#slot-validatewithhead) | `boolean` | validate the token with a HEAD request before using it |

<details>
<summary>ExternalTokenInternetAccount - Slots</summary>

#### slot: validateWithHEAD

validate the token with a HEAD request before using it

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details>
<summary>Inherited from BaseInternetAccount</summary>

[BaseInternetAccount config →](../baseinternetaccount)

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
