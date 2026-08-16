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

## Related links

- **Extended by:**
  [ExternalTokenInternetAccount](../externaltokeninternetaccount)
- **Extended by:** [HTTPBasicInternetAccount](../httpbasicinternetaccount)
- **Extended by:** [OAuthInternetAccount](../oauthinternetaccount)

## Config slots

`BaseInternetAccount` is a shared base schema, not a type you name in a config.
Set these slots on one of the configs under **Extended by** above, each of which
lists them as inherited and shows the shape in its own example. Slot types
(`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | descriptive name of the internet account |
| <span id="slot-description">**description**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a description of the internet account |
| <span id="slot-authheader">**authHeader**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'Authorization'</code> | request header for credentials |
| <span id="slot-tokentype">**tokenType**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a custom name for a token to include in the header |
| <span id="slot-domains">**domains**</span><br>`stringArray` = <code>[]</code> | array of valid domains the url can contain to use this account |
