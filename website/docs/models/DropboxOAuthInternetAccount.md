---
id: dropboxoauthinternetaccount
title: DropboxOAuthInternetAccount
description: "Properties, getters and actions of the DropboxOAuthInternetAccount state model."
sidebar_label: Internet Account -> DropboxOAuthInternetAccount
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `authentication` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/DropboxOAuthModel/model.tsx).

The configuration slots for this model are documented on its [config schema page](../../config/dropboxoauthinternetaccount).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('DropboxOAuthInternetAccount')</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-togglecontents">**toggleContents**</span><br><code>Element</code> | The FileSelector icon for Dropbox |
| <span id="getter-selectorlabel">**selectorLabel**</span><br><code>string</code> |  |
| <span id="getter-authflowparams">**authFlowParams**</span><br><code>{ token_access_type: string; }</code> | Dropbox issues a refresh token only when the authorization request asks for offline access, and spells that `token_access_type` where other providers use `access_type` — so it belongs here rather than on every OAuth account. |

<span data-pagefind-ignore>From [OAuthInternetAccount](../oauthinternetaccount): <span id="getter-conf">[`conf`](../oauthinternetaccount#getter-conf)</span>, <span id="getter-authendpoint">[`authEndpoint`](../oauthinternetaccount#getter-authendpoint)</span>, <span id="getter-tokenendpoint">[`tokenEndpoint`](../oauthinternetaccount#getter-tokenendpoint)</span>, <span id="getter-needspkce">[`needsPKCE`](../oauthinternetaccount#getter-needspkce)</span>, <span id="getter-clientid">[`clientId`](../oauthinternetaccount#getter-clientid)</span>, <span id="getter-scopes">[`scopes`](../oauthinternetaccount#getter-scopes)</span>, <span id="getter-state">[`state`](../oauthinternetaccount#getter-state)</span>, <span id="getter-responsetype">[`responseType`](../oauthinternetaccount#getter-responsetype)</span>, <span id="getter-refreshtokenkey">[`refreshTokenKey`](../oauthinternetaccount#getter-refreshtokenkey)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-getfetcher">**getFetcher**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(location?: UriLocation &#124; undefined) =&gt; (input: RequestInfo, in…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(location?: UriLocation &#124; undefined) =&gt; (input: RequestInfo, init?: RequestInit &#124; undefined) =&gt; Promise&lt;Response&gt;</code></pre></dialog></span> |  |

<span data-pagefind-ignore>From [OAuthInternetAccount](../oauthinternetaccount): <span id="method-retrieverefreshtoken">[`retrieveRefreshToken`](../oauthinternetaccount#method-retrieverefreshtoken)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-validatetoken">**validateToken**</span><br><code>(token: string, location: UriLocation) =&gt; Promise&lt;string&gt;</code> |  |

<span data-pagefind-ignore>From [OAuthInternetAccount](../oauthinternetaccount): <span id="action-storerefreshtoken">[`storeRefreshToken`](../oauthinternetaccount#action-storerefreshtoken)</span>, <span id="action-removerefreshtoken">[`removeRefreshToken`](../oauthinternetaccount#action-removerefreshtoken)</span>, <span id="action-posttokengrant">[`postTokenGrant`](../oauthinternetaccount#action-posttokengrant)</span>, <span id="action-exchangeauthorizationforaccesstoken">[`exchangeAuthorizationForAccessToken`](../oauthinternetaccount#action-exchangeauthorizationforaccesstoken)</span>, <span id="action-exchangerefreshforaccesstoken">[`exchangeRefreshForAccessToken`](../oauthinternetaccount#action-exchangerefreshforaccesstoken)</span>, <span id="action-validatetokenwithprobe">[`validateTokenWithProbe`](../oauthinternetaccount#action-validatetokenwithprobe)</span>, <span id="action-gettokenviaauthflow">[`getTokenViaAuthFlow`](../oauthinternetaccount#action-gettokenviaauthflow)</span>, <span id="action-gettokenfromuser">[`getTokenFromUser`](../oauthinternetaccount#action-gettokenfromuser)</span></span>
