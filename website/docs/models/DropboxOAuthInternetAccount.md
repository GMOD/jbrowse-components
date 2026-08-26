---
id: dropboxoauthinternetaccount
title: DropboxOAuthInternetAccount
sidebar_label: Internet Account -> DropboxOAuthInternetAccount
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/DropboxOAuthModel/model.tsx).

The configuration slots for this model are documented on its
[config schema page](../../config/dropboxoauthinternetaccount).

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('DropboxOAuthInternetAccount')</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-togglecontents">**toggleContents**</span><br><code>Element</code> | The FileSelector icon for Dropbox | DropboxOAuthInternetAccount |
| <span id="getter-selectorlabel">**selectorLabel**</span><br><code>string</code> |  | DropboxOAuthInternetAccount |
| <span id="getter-authflowparams">**authFlowParams**</span><br><code>{ token_access_type: string; }</code> | Dropbox issues a refresh token only when the authorization request asks for offline access, and spells that `token_access_type` where other providers use `access_type` — so it belongs here rather than on every OAuth account. | DropboxOAuthInternetAccount |
| <span id="getter-conf">**conf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;Record&lt;…&gt;&gt; &amp; { setSubschema(slotName: st…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;Record&lt;…&gt;&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;</code></pre></dialog></span> | <span data-pagefind-ignore>The config typed off the concrete schema. `ConfigurationReference` erases `self.configuration` to `any` (the reference's MST instance brand doesn't carry the schema's slot definitions), so reads go through this getter to recover per-slot types and slot-name validation.</span> | [OAuthInternetAccount](../oauthinternetaccount#getter-conf) |
| <span id="getter-authendpoint">**authEndpoint**</span><br><code>string</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-authendpoint) |
| <span id="getter-tokenendpoint">**tokenEndpoint**</span><br><code>string</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-tokenendpoint) |
| <span id="getter-needspkce">**needsPKCE**</span><br><code>boolean</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-needspkce) |
| <span id="getter-clientid">**clientId**</span><br><code>string</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-clientid) |
| <span id="getter-scopes">**scopes**</span><br><code>string</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-scopes) |
| <span id="getter-state">**state**</span><br><code>string</code> | <span data-pagefind-ignore>OAuth state parameter: https://www.rfc-editor.org/rfc/rfc6749#section-4.1.1<br><br>Can override or extend if dynamic state is needed.</span> | [OAuthInternetAccount](../oauthinternetaccount#getter-state) |
| <span id="getter-responsetype">**responseType**</span><br><code>"code" &#124; "token"</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-responsetype) |
| <span id="getter-refreshtokenkey">**refreshTokenKey**</span><br><code>string</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-refreshtokenkey) |

## Methods

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="method-getfetcher">**getFetcher**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(location?: UriLocation &#124; undefined) =&gt; (input: RequestInfo, in…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(location?: UriLocation &#124; undefined) =&gt; (input: RequestInfo, init?: RequestInit &#124; undefined) =&gt; Promise&lt;Response&gt;</code></pre></dialog></span> |  | DropboxOAuthInternetAccount |
| <span id="method-retrieverefreshtoken">**retrieveRefreshToken**</span><br><code>() =&gt; string &#124; undefined</code> |  | [OAuthInternetAccount](../oauthinternetaccount#method-retrieverefreshtoken) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-validatetoken">**validateToken**</span><br><code>(token: string, location: UriLocation) =&gt; Promise&lt;string&gt;</code> |  | DropboxOAuthInternetAccount |
| <span id="action-storerefreshtoken">**storeRefreshToken**</span><br><code>(refreshToken: string) =&gt; void</code> |  | [OAuthInternetAccount](../oauthinternetaccount#action-storerefreshtoken) |
| <span id="action-removerefreshtoken">**removeRefreshToken**</span><br><code>() =&gt; void</code> |  | [OAuthInternetAccount](../oauthinternetaccount#action-removerefreshtoken) |
| <span id="action-posttokengrant">**postTokenGrant**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(grant: Record&lt;string, string&gt;, describeError: (response: Respo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(grant: Record&lt;string, string&gt;, describeError: (response: Response) =&gt; Promise&lt;string&gt;) =&gt; Promise&lt;string&gt;</code></pre></dialog></span> | <span data-pagefind-ignore>POST a grant to the token endpoint and read the access token out of the answer. Both grants this account makes — trading the authorization code on the way in, trading the refresh token when the access token expires — are the same form-encoded request to the same endpoint answered by the same body, and OAuth 2 says so (RFC 6749 §4.1.3, §6). They differ in the grant's own parameters and in what a failure means, which is what stays at the call sites.</span> | [OAuthInternetAccount](../oauthinternetaccount#action-posttokengrant) |
| <span id="action-exchangeauthorizationforaccesstoken">**exchangeAuthorizationForAccessToken**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(code: string, redirectUri: string, codeVerifier: string &#124; unde…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(code: string, redirectUri: string, codeVerifier: string &#124; undefined) =&gt; Promise&lt;string&gt;</code></pre></dialog></span> |  | [OAuthInternetAccount](../oauthinternetaccount#action-exchangeauthorizationforaccesstoken) |
| <span id="action-exchangerefreshforaccesstoken">**exchangeRefreshForAccessToken**</span><br><code>(refreshToken: string) =&gt; Promise&lt;string&gt;</code> |  | [OAuthInternetAccount](../oauthinternetaccount#action-exchangerefreshforaccesstoken) |
| <span id="action-validatetokenwithprobe">**validateTokenWithProbe**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(token: string, probe: (token: string) =&gt; Promise&lt;Response&gt;, de…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(token: string, probe: (token: string) =&gt; Promise&lt;Response&gt;, describeError: (response: Response, reason?: string &#124; undefined) =&gt; Promise&lt;string&gt;) =&gt; Promise&lt;...&gt;</code></pre></dialog></span> | <span data-pagefind-ignore>Prove a token against the resource and, if that fails, refresh it once and prove the new one. Returns whichever token worked; throws if neither does. Every OAuth account validates this way and they differ only in what a probe is — a HEAD of the resource here, a metadata call for Dropbox and Google Drive.</span> | [OAuthInternetAccount](../oauthinternetaccount#action-validatetokenwithprobe) |
| <span id="action-gettokenviaauthflow">**getTokenViaAuthFlow**</span><br><code>() =&gt; Promise&lt;string&gt;</code> | <span data-pagefind-ignore>Opens the provider's auth page and returns a promise for the resulting token. For Electron, drives the flow directly via IPC; for web, opens a popup and waits for the redirect message.</span> | [OAuthInternetAccount](../oauthinternetaccount#action-gettokenviaauthflow) |
| <span id="action-gettokenfromuser">**getTokenFromUser**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(resolve: (token: string) =&gt; void, reject: (error: Error) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(resolve: (token: string) =&gt; void, reject: (error: Error) =&gt; void) =&gt; Promise&lt;void&gt;</code></pre></dialog></span> |  | [OAuthInternetAccount](../oauthinternetaccount#action-gettokenfromuser) |
