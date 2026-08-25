---
id: tokenentryinternetaccount
title: TokenEntryInternetAccount
sidebar_label: Internet Account -> TokenEntryInternetAccount
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `authentication` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/tokenEntryModelFactory.ts).

Shared base for internet accounts whose token is supplied by the user through
a dialog (HTTP Basic, external token). Such accounts differ only in their
discriminating `type` and the dialog form used to collect the token, both
passed here. Not registered on its own — see HTTPBasicInternetAccount and
ExternalTokenInternetAccount.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal(typeName)</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-validatewithhead">**validateWithHEAD**</span><br><code>boolean</code> | validate the token with a HEAD request before it is used |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-gettokenfromuser">**getTokenFromUser**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(resolve: (token: string) =&gt; void, reject: (error: Error) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(resolve: (token: string) =&gt; void, reject: (error: Error) =&gt; void) =&gt; void</code></pre></dialog></span> | Prompt the user for a token via the account's dialog form, resolving with the entered token or rejecting if the user cancels. |
| <span id="action-validatetoken">**validateToken**</span><br><code>(token: string, location: UriLocation) =&gt; Promise&lt;string&gt;</code> | Optionally validate the token with a HEAD request before use, per the `validateWithHEAD` config slot. |
