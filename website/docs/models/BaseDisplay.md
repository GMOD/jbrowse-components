---
id: basedisplay
title: BaseDisplay
sidebar_label: Display -> BaseDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseDisplayModel.tsx).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.string</code> |  |
| <span id="property-rpcdrivername">**rpcDriverName**</span><br><code>rpcDriverName: types.maybe(types.string)</code> |  |
| <span id="property-ignorepromoteddefaults">**ignorePromotedDefaults**</span><br><code>ignorePromotedDefaults: types.stripDefault(types.boolean, false)</code> | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL). Such a display resolves its `promotable` config slots from its own config only, never from this browser's promoted display-type defaults (see `configuration/promotableDefaults.ts`) — the received session is a record of what the sender saw, and a local preference silently repainting it would make it a lie. A track opened *afterwards* in that same session is a fresh track of this user's, so it never gets the flag and picks up their defaults normally. Cleared by `resetSlotsToInherit` when the user deliberately makes the display follow a default. |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-error">**error**</span><br><code>error: undefined as unknown</code> |  |
| <span id="volatile-statusmessage">**statusMessage**</span><br><code>statusMessage: undefined as string &#124; undefined</code> |  |
| <span id="volatile-statusprogress">**statusProgress**</span><br><code>statusProgress: undefined as number &#124; undefined</code> | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate. Set alongside `statusMessage` by `setStatusMessage`; a display that never shows a bar simply leaves it undefined. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-parenttrack">**parentTrack**</span><br><code>AbstractTrackModel</code> |  |
| <span id="getter-parentdisplay">**parentDisplay**</span><br><details><summary><code>{ type?: string &#124; undefined; effectiveRpcDriverName?: string &#124;…</code></summary><pre><code>{ type?: string &#124; undefined; effectiveRpcDriverName?: string &#124; undefined; } &#124; undefined</code></pre></details> | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay) |
| <span id="getter-renderingcomponent">**RenderingComponent**</span><br><code>FC&lt;…&gt;</code> |  |
| <span id="getter-displayblurb">**DisplayBlurb**</span><br><details><summary><code>FC&lt;{ model: ModelInstanceTypeProps&lt;…&gt; &amp; { ...; } &amp; { ...; } &amp; I…</code></summary><pre><code>FC&lt;{ model: ModelInstanceTypeProps&lt;…&gt; &amp; { ...; } &amp; { ...; } &amp; IStateTreeNode&lt;...&gt;; }&gt; &#124; null</code></pre></details> |  |
| <span id="getter-adapterconfig">**adapterConfig**</span><br><code>any</code> |  |
| <span id="getter-isminimized">**isMinimized**</span><br><code>boolean</code> | Returns true if the parent track is minimized. Used to skip expensive operations like autoruns when track is not visible. |
| <span id="getter-effectiverpcdrivername">**effectiveRpcDriverName**</span><br><code>any</code> | Returns the effective RPC driver name with hierarchical fallback: 1. This display's explicit rpcDriverName 2. Parent display's effectiveRpcDriverName (for nested displays) 3. Track config's rpcDriverName |
| <span id="getter-displaymessagecomponent">**DisplayMessageComponent**</span><br><code>FC&lt;any&gt; &#124; undefined</code> | if a display-level message should be displayed instead, make this return a react component |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-renderingprops">**renderingProps**</span><br><details><summary><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;…&gt; &amp; { ...; } &amp; {…</code></summary><pre><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;…&gt; &amp; { ...; } &amp; { ...; } &amp; { ...; } &amp; IStateTreeNode&lt;...&gt;; }</code></pre></details> | props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setignorepromoteddefaults">**setIgnorePromotedDefaults**</span><br><code>(flag: boolean) =&gt; void</code> | see the `ignorePromotedDefaults` property |
| <span id="action-setstatusmessage">**setStatusMessage**</span><br><code>(status?: RpcStatus &#124; undefined) =&gt; void</code> |  |
| <span id="action-seterror">**setError**</span><br><code>(error?: unknown) =&gt; void</code> |  |
| <span id="action-setrpcdrivername">**setRpcDriverName**</span><br><code>(rpcDriverName: string) =&gt; void</code> |  |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | base display reload does nothing, see specialized displays for details |
