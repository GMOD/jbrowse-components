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

These slots are top-level fields of the account's entry in `internetAccounts`.
Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description | From |
| --- | --- | --- |
| <span id="slot-validatewithhead">**validateWithHEAD**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | validate the token with a HEAD request before using it |  |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | descriptive name of the internet account | [BaseInternetAccount](../baseinternetaccount) |
| <span id="slot-description">**description**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a description of the internet account | [BaseInternetAccount](../baseinternetaccount) |
| <span id="slot-authheader">**authHeader**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'Authorization'</code> | request header for credentials | [BaseInternetAccount](../baseinternetaccount) |
| <span id="slot-tokentype">**tokenType**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a custom name for a token to include in the header | [BaseInternetAccount](../baseinternetaccount) |
| <span id="slot-domains">**domains**</span><br>`stringArray` = <code>[]</code> | array of valid domains the url can contain to use this account | [BaseInternetAccount](../baseinternetaccount) |
