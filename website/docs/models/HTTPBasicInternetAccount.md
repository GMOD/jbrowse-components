---
id: httpbasicinternetaccount
title: HTTPBasicInternetAccount
description: "Internet account that authenticates requests with an HTTP Basic username/password the user enters through a dialog, optionally validated with a HEAD request. See…"
sidebar_label: Internet Account -> HTTPBasicInternetAccount
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `authentication` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/HTTPBasicModel/model.tsx).

Internet account that authenticates requests with an HTTP Basic
username/password the user enters through a dialog, optionally validated with
a HEAD request. See [TokenEntryInternetAccount](../tokenentryinternetaccount)
for the shared behavior.

The configuration slots for this model are documented on its [config schema page](../../config/httpbasicinternetaccount).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<span data-pagefind-ignore>From [TokenEntryInternetAccount](../tokenentryinternetaccount): <span id="property-type">[`type`](../tokenentryinternetaccount#property-type)</span>, <span id="property-configuration">[`configuration`](../tokenentryinternetaccount#property-configuration)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-showinfileselector">**showInFileSelector**</span><br><code>boolean</code> | There is nothing to pick: an HTTP Basic account matches by domain and prompts on its own. RpcManager also mints one of these per origin on a 401, so offering them would fill the picker with a toggle per server the session happened to touch. |

<span data-pagefind-ignore>From [TokenEntryInternetAccount](../tokenentryinternetaccount): <span id="getter-validatewithhead">[`validateWithHEAD`](../tokenentryinternetaccount#getter-validatewithhead)</span></span>

## Actions

<span data-pagefind-ignore>From [TokenEntryInternetAccount](../tokenentryinternetaccount): <span id="action-gettokenfromuser">[`getTokenFromUser`](../tokenentryinternetaccount#action-gettokenfromuser)</span>, <span id="action-validatetoken">[`validateToken`](../tokenentryinternetaccount#action-validatetoken)</span></span>
