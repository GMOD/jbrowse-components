---
id: externaltokeninternetaccount
title: ExternalTokenInternetAccount
sidebar_label: Internet Account -> ExternalTokenInternetAccount
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/ExternalTokenModel/model.tsx).

Internet account that authenticates requests with a user-supplied external
token, prompting for the token via a dialog and optionally validating it with a
HEAD request. See [TokenEntryInternetAccount](../tokenentryinternetaccount) for
the shared behavior.

The configuration slots for this model are documented on its
[config schema page](../../config/externaltokeninternetaccount).

ExternalTokenInternetAccount declares no members of its own — it composes the
models below, and everything here is theirs.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal(typeName)</code> |  | [TokenEntryInternetAccount](../tokenentryinternetaccount#property-type) |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  | [TokenEntryInternetAccount](../tokenentryinternetaccount#property-configuration) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-validatewithhead">**validateWithHEAD**</span><br><code>boolean</code> | <span data-pagefind-ignore>validate the token with a HEAD request before it is used</span> | [TokenEntryInternetAccount](../tokenentryinternetaccount#getter-validatewithhead) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-gettokenfromuser">**getTokenFromUser**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(resolve: (token: string) =&gt; void, reject: (error: Error) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(resolve: (token: string) =&gt; void, reject: (error: Error) =&gt; void) =&gt; void</code></pre></dialog></span> | <span data-pagefind-ignore>Prompt the user for a token via the account's dialog form, resolving with the entered token or rejecting if the user cancels.</span> | [TokenEntryInternetAccount](../tokenentryinternetaccount#action-gettokenfromuser) |
| <span id="action-validatetoken">**validateToken**</span><br><code>(token: string, location: UriLocation) =&gt; Promise&lt;string&gt;</code> | <span data-pagefind-ignore>Optionally validate the token with a HEAD request before use, per the `validateWithHEAD` config slot.</span> | [TokenEntryInternetAccount](../tokenentryinternetaccount#action-validatetoken) |
