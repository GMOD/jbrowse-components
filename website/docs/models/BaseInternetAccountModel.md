---
id: baseinternetaccountmodel
title: BaseInternetAccountModel
sidebar_label: Internet Account -> BaseInternetAccountModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/InternetAccountModel.ts).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.string</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(BaseInternetAccountConfig)</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-name">**name**</span><br><code>string</code> |  |
| <span id="getter-description">**description**</span><br><code>string</code> |  |
| <span id="getter-internetaccountid">**internetAccountId**</span><br><code>string</code> |  |
| <span id="getter-authheader">**authHeader**</span><br><code>string</code> |  |
| <span id="getter-tokentype">**tokenType**</span><br><code>string</code> |  |
| <span id="getter-domains">**domains**</span><br><code>string[]</code> |  |
| <span id="getter-togglecontents">**toggleContents**</span><br><code>ReactNode</code> | Can use this to customize what is displayed in fileSelector's toggle box |
| <span id="getter-selectorlabel">**selectorLabel**</span><br><code>string &#124; undefined</code> | Can use this to add a label to the UrlChooser |
| <span id="getter-showinfileselector">**showInFileSelector**</span><br><code>boolean</code> | Whether the fileSelector offers this account as a source to pick. Turn it off for an account that only ever matches by domain and has nothing of its own to enter — HTTP Basic, whose ephemeral per-origin accounts would otherwise pile up as toggles nobody asked for. |
| <span id="getter-tokenkey">**tokenKey**</span><br><code>string</code> | The key used to store this internetAccount's token in sessionStorage |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-handleslocation">**handlesLocation**</span><br><code>(location: UriLocation) =&gt; boolean</code> | Determine whether this internetAccount provides credentials for a URL |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-gettokenfromuser">**getTokenFromUser**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(_resolve: (token: string) =&gt; void, _reject: (error: Error) =&gt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(_resolve: (token: string) =&gt; void, _reject: (error: Error) =&gt; void) =&gt; void</code></pre></dialog></span> | Must be implemented by a model extending or composing this one. Pass the user's token to `resolve`. |
| <span id="action-storetoken">**storeToken**</span><br><code>(token: string) =&gt; void</code> |  |
| <span id="action-retrievetoken">**retrieveToken**</span><br><code>() =&gt; string &#124; undefined</code> |  |
| <span id="action-validatetoken">**validateToken**</span><br><code>(token: string, _loc: UriLocation) =&gt; Promise&lt;string&gt;</code> | This can be used by an internetAccount to validate a token works before it is used. This is run when preAuthorizationInformation is requested, so it can be used to check that a token is valid before sending it to a worker thread. It expects the token to be returned so that this action can also be used to generate a new token (e.g. by using a refresh token) if the original one was invalid. Should throw an error if a token is invalid. |
| <span id="action-removetoken">**removeToken**</span><br><code>() =&gt; void</code> | Clears the stored token. Also drops the in-memory cached promise so a subsequent `getToken` re-prompts / re-derives rather than handing back the token that was just invalidated. |
| <span id="action-gettoken">**getToken**</span><br><code>(location?: UriLocation &#124; undefined) =&gt; Promise&lt;string&gt;</code> | Try to get the token from the location pre-auth, from local storage, or from a previously cached promise. If token is not available, uses `getTokenFromUser`. |
| <span id="action-addauthheadertoinit">**addAuthHeaderToInit**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(init?: RequestInit &#124; undefined, token?: string &#124; undefined) =&gt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(init?: RequestInit &#124; undefined, token?: string &#124; undefined) =&gt; {…}</code></pre></dialog></span> |  |
| <span id="action-fetchwithtoken">**fetchWithToken**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(loc: UriLocation &#124; undefined, run: (token: string) =&gt; Promise&lt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(loc: UriLocation &#124; undefined, run: (token: string) =&gt; Promise&lt;Response&gt;) =&gt; Promise&lt;Response&gt;</code></pre></dialog></span> | Run a request with the current token and, only if it comes back 401, put the token through `validateToken` and run it exactly once more. This is how every account's fetcher reaches a resource. |
| <span id="action-getpreauthorizationinformation">**getPreAuthorizationInformation**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(location: UriLocation) =&gt; Promise&lt;{ internetAccountType: strin…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(location: UriLocation) =&gt; Promise&lt;{ internetAccountType: string; authInfo: { token: string; configuration: ModelSnapshotType&lt;Record&lt;string, any&gt;&gt;; }; }&gt;</code></pre></dialog></span> | Gets the token and returns it along with the information needed to create a new internetAccount. |
| <span id="action-getfetcher">**getFetcher**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(loc?: UriLocation &#124; undefined) =&gt; (input: RequestInfo, init?:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(loc?: UriLocation &#124; undefined) =&gt; (input: RequestInfo, init?: RequestInit &#124; undefined) =&gt; Promise&lt;Response&gt;</code></pre></dialog></span> | Get a fetch method that will add any needed authentication headers to the request before sending it. If location is provided, it will be checked to see if it includes a token in it pre-auth information. |
| <span id="action-openlocation">**openLocation**</span><br><code>(location: UriLocation) =&gt; RemoteFileWithRangeCache</code> | Gets a filehandle that uses a fetch that adds auth headers |
