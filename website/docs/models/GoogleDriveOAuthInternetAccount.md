---
id: googledriveoauthinternetaccount
title: GoogleDriveOAuthInternetAccount
sidebar_label: Internet Account -> GoogleDriveOAuthInternetAccount
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/GoogleDriveOAuthModel/model.tsx).

The configuration slots for this model are documented on its
[config schema page](../../config/googledriveoauthinternetaccount).

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('GoogleDriveOAuthInternetAccount')</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-togglecontents">**toggleContents**</span><br><code>Element</code> | The FileSelector icon for Google drive | GoogleDriveOAuthInternetAccount |
| <span id="getter-selectorlabel">**selectorLabel**</span><br><code>string</code> |  | GoogleDriveOAuthInternetAccount |
| <span id="getter-conf">**conf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;Record&lt;…&gt;&gt; &amp; { setSubschema(slotName: st…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;Record&lt;…&gt;&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;</code></pre></dialog></span> | <span data-pagefind-ignore>The config typed off the concrete schema. `ConfigurationReference` erases `self.configuration` to `any` (the reference's MST instance brand doesn't carry the schema's slot definitions), so reads go through this getter to recover per-slot types and slot-name validation.</span> | [OAuthInternetAccount](../oauthinternetaccount#getter-conf) |
| <span id="getter-codeverifierpkce">**codeVerifierPKCE**</span><br><code>string</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-codeverifierpkce) |
| <span id="getter-authendpoint">**authEndpoint**</span><br><code>string</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-authendpoint) |
| <span id="getter-tokenendpoint">**tokenEndpoint**</span><br><code>string</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-tokenendpoint) |
| <span id="getter-needspkce">**needsPKCE**</span><br><code>boolean</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-needspkce) |
| <span id="getter-clientid">**clientId**</span><br><code>string</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-clientid) |
| <span id="getter-scopes">**scopes**</span><br><code>string</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-scopes) |
| <span id="getter-state">**state**</span><br><code>string</code> | <span data-pagefind-ignore>OAuth state parameter: https://www.rfc-editor.org/rfc/rfc6749#section-4.1.1<br><br>Can override or extend if dynamic state is needed.</span> | [OAuthInternetAccount](../oauthinternetaccount#getter-state) |
| <span id="getter-responsetype">**responseType**</span><br><code>"code" &#124; "token"</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-responsetype) |
| <span id="getter-refreshtokenkey">**refreshTokenKey**</span><br><code>string</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-refreshtokenkey) |
| <span id="getter-authflowparams">**authFlowParams**</span><br><code>Record&lt;string, string&gt;</code> | <span data-pagefind-ignore>Extra parameters to add to the authorization request. Empty here; a provider that needs one of its own overrides this.</span> | [OAuthInternetAccount](../oauthinternetaccount#getter-authflowparams) |

## Methods

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="method-getfetcher">**getFetcher**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(location?: UriLocation &#124; undefined) =&gt; (input: RequestInfo, in…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(location?: UriLocation &#124; undefined) =&gt; (input: RequestInfo, init?: RequestInitWithMetadata &#124; undefined) =&gt; Promise&lt;Response&gt;</code></pre></dialog></span> |  | GoogleDriveOAuthInternetAccount |
| <span id="method-openlocation">**openLocation**</span><br><code>(location: UriLocation) =&gt; GoogleDriveFile</code> |  | GoogleDriveOAuthInternetAccount |
| <span id="method-retrieverefreshtoken">**retrieveRefreshToken**</span><br><code>() =&gt; string &#124; null</code> |  | [OAuthInternetAccount](../oauthinternetaccount#method-retrieverefreshtoken) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-validatetoken">**validateToken**</span><br><code>(token: string, location: UriLocation) =&gt; Promise&lt;string&gt;</code> |  | GoogleDriveOAuthInternetAccount |
| <span id="action-storerefreshtoken">**storeRefreshToken**</span><br><code>(refreshToken: string) =&gt; void</code> |  | [OAuthInternetAccount](../oauthinternetaccount#action-storerefreshtoken) |
| <span id="action-removerefreshtoken">**removeRefreshToken**</span><br><code>() =&gt; void</code> |  | [OAuthInternetAccount](../oauthinternetaccount#action-removerefreshtoken) |
| <span id="action-replacetoken">**replaceToken**</span><br><code>(token: string) =&gt; void</code> | <span data-pagefind-ignore>Swap in an access token obtained from a refresh, in place of the one it replaces.</span> | [OAuthInternetAccount](../oauthinternetaccount#action-replacetoken) |
| <span id="action-exchangeauthorizationforaccesstoken">**exchangeAuthorizationForAccessToken**</span><br><code>(code: string, redirectUri: string) =&gt; Promise&lt;string&gt;</code> |  | [OAuthInternetAccount](../oauthinternetaccount#action-exchangeauthorizationforaccesstoken) |
| <span id="action-exchangerefreshforaccesstoken">**exchangeRefreshForAccessToken**</span><br><code>(refreshToken: string) =&gt; Promise&lt;string&gt;</code> |  | [OAuthInternetAccount](../oauthinternetaccount#action-exchangerefreshforaccesstoken) |
| <span id="action-gettokenviaauthflow">**getTokenViaAuthFlow**</span><br><code>() =&gt; Promise&lt;string&gt;</code> | <span data-pagefind-ignore>Opens the provider's auth page and returns a promise for the resulting token. For Electron, drives the flow directly via IPC; for web, opens a popup and waits for the redirect message.</span> | [OAuthInternetAccount](../oauthinternetaccount#action-gettokenviaauthflow) |
| <span id="action-gettokenfromuser">**getTokenFromUser**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(resolve: (token: string) =&gt; void, reject: (error: Error) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(resolve: (token: string) =&gt; void, reject: (error: Error) =&gt; void) =&gt; Promise&lt;void&gt;</code></pre></dialog></span> |  | [OAuthInternetAccount](../oauthinternetaccount#action-gettokenfromuser) |
| <span id="action-fetchwithtoken">**fetchWithToken**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(loc: UriLocation &#124; undefined, run: (token: string) =&gt; Promise&lt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(loc: UriLocation &#124; undefined, run: (token: string) =&gt; Promise&lt;Response&gt;) =&gt; Promise&lt;Response&gt;</code></pre></dialog></span> | <span data-pagefind-ignore>Run a request with the current token and, only if it comes back 401, refresh the token through `validateToken` and run it exactly once more. This is how the fetchers reach a resource.</span> | [OAuthInternetAccount](../oauthinternetaccount#action-fetchwithtoken) |
| <span id="action-getfetcher">**getFetcher**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(loc?: UriLocation &#124; undefined) =&gt; (input: RequestInfo, init?:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(loc?: UriLocation &#124; undefined) =&gt; (input: RequestInfo, init?: RequestInit &#124; undefined) =&gt; Promise&lt;Response&gt;</code></pre></dialog></span> |  | [OAuthInternetAccount](../oauthinternetaccount#action-getfetcher) |
