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
| <span id="getter-conf">**conf**</span><br><details><summary><code>ModelInstanceTypeProps&lt;Record&lt;…&gt;&gt; &amp; { setSubschema(slotName: st…</code></summary><pre><code>ModelInstanceTypeProps&lt;Record&lt;…&gt;&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;</code></pre></details> | <span data-pagefind-ignore>The config typed off the concrete schema. `ConfigurationReference` erases `self.configuration` to `any` (the reference's MST instance brand doesn't carry the schema's slot definitions), so reads go through this getter to recover per-slot types and slot-name validation.</span> | [OAuthInternetAccount](../oauthinternetaccount#getter-conf) |
| <span id="getter-codeverifierpkce">**codeVerifierPKCE**</span><br><code>string</code> |  | [OAuthInternetAccount](../oauthinternetaccount#getter-codeverifierpkce) |
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
| <span id="method-getfetcher">**getFetcher**</span><br><details><summary><code>(location?: UriLocation &#124; undefined) =&gt; (input: RequestInfo, in…</code></summary><pre><code>(location?: UriLocation &#124; undefined) =&gt; (input: RequestInfo, init?: RequestInit &#124; undefined) =&gt; Promise&lt;Response&gt;</code></pre></details> |  | DropboxOAuthInternetAccount |
| <span id="method-retrieverefreshtoken">**retrieveRefreshToken**</span><br><code>() =&gt; string &#124; null</code> |  | [OAuthInternetAccount](../oauthinternetaccount#method-retrieverefreshtoken) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-validatetoken">**validateToken**</span><br><code>(token: string, location: UriLocation) =&gt; Promise&lt;string&gt;</code> |  | DropboxOAuthInternetAccount |
| <span id="action-storerefreshtoken">**storeRefreshToken**</span><br><code>(refreshToken: string) =&gt; void</code> |  | [OAuthInternetAccount](../oauthinternetaccount#action-storerefreshtoken) |
| <span id="action-removerefreshtoken">**removeRefreshToken**</span><br><code>() =&gt; void</code> |  | [OAuthInternetAccount](../oauthinternetaccount#action-removerefreshtoken) |
| <span id="action-exchangeauthorizationforaccesstoken">**exchangeAuthorizationForAccessToken**</span><br><code>(code: string, redirectUri: string) =&gt; Promise&lt;string&gt;</code> |  | [OAuthInternetAccount](../oauthinternetaccount#action-exchangeauthorizationforaccesstoken) |
| <span id="action-exchangerefreshforaccesstoken">**exchangeRefreshForAccessToken**</span><br><code>(refreshToken: string) =&gt; Promise&lt;string&gt;</code> |  | [OAuthInternetAccount](../oauthinternetaccount#action-exchangerefreshforaccesstoken) |
| <span id="action-gettokenviaauthflow">**getTokenViaAuthFlow**</span><br><code>() =&gt; Promise&lt;string&gt;</code> | <span data-pagefind-ignore>Opens the provider's auth page and returns a promise for the resulting token. For Electron, drives the flow directly via IPC; for web, opens a popup and waits for the redirect message.</span> | [OAuthInternetAccount](../oauthinternetaccount#action-gettokenviaauthflow) |
| <span id="action-gettokenfromuser">**getTokenFromUser**</span><br><details><summary><code>(resolve: (token: string) =&gt; void, reject: (error: Error) =&gt; vo…</code></summary><pre><code>(resolve: (token: string) =&gt; void, reject: (error: Error) =&gt; void) =&gt; Promise&lt;void&gt;</code></pre></details> |  | [OAuthInternetAccount](../oauthinternetaccount#action-gettokenfromuser) |
| <span id="action-getfetcher">**getFetcher**</span><br><details><summary><code>(loc?: UriLocation &#124; undefined) =&gt; (input: RequestInfo, init?:…</code></summary><pre><code>(loc?: UriLocation &#124; undefined) =&gt; (input: RequestInfo, init?: RequestInit &#124; undefined) =&gt; Promise&lt;Response&gt;</code></pre></details> |  | [OAuthInternetAccount](../oauthinternetaccount#action-getfetcher) |
