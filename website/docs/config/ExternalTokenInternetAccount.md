---
id: externaltokeninternetaccount
title: ExternalTokenInternetAccount
sidebar_label: Internet Account -> ExternalTokenInternetAccount
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `authentication` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/ExternalTokenModel/configSchema.ts).

## Example usage

For a token the user pastes in, or that an embedding portal hands over.
JBrowse does not obtain the token itself — it prompts for one, then sends it
on every request to a matching domain.

```js
{
  type: 'ExternalTokenInternetAccount',
  internetAccountId: 'portalToken',
  name: 'Data portal token',
  domains: ['api.myportal.org'],
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **State model:** [runtime API](../../models/externaltokeninternetaccount)
- **Base config:** [BaseInternetAccount](../baseinternetaccount)

## Config slots

These slots are top-level fields of the account's entry in `internetAccounts`. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-validatewithhead">**validateWithHEAD**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | validate the token with a HEAD request before using it |
| <span class="slot-group">Inherited from [BaseInternetAccount](../baseinternetaccount)</span> | <span class="slot-group-count">5 slots</span> |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | descriptive name of the internet account |
| <span id="slot-description">**description**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a description of the internet account |
| <span id="slot-authheader">**authHeader**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'Authorization'</code> | request header for credentials |
| <span id="slot-tokentype">**tokenType**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a custom name for a token to include in the header |
| <span id="slot-domains">**domains**</span><br>`stringArray` = <code>[]</code> | array of valid domains the url can contain to use this account |
