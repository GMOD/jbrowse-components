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
| <span id="getter-parentdisplay">**parentDisplay**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ type?: string &#124; undefined; effectiveRpcDriverName?: string &#124;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ type?: string &#124; undefined; effectiveRpcDriverName?: string &#124; undefined; } &#124; undefined</code></pre></dialog></span> | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay) |
| <span id="getter-renderingcomponent">**RenderingComponent**</span><br><code>FC&lt;…&gt;</code> |  |
| <span id="getter-displayblurb">**DisplayBlurb**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>FC&lt;{ model: ModelInstanceTypeProps&lt;{ id: IOptionalIType&lt;…&gt;; typ…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>FC&lt;{ model: ModelInstanceTypeProps&lt;{ id: IOptionalIType&lt;…&gt;; type: ISimpleType&lt;…&gt;; rpcDriverName: IMaybe&lt;ISimpleType&lt;…&gt;&gt;; }&gt; &amp; { ...; } &amp; { ...; } &amp; IStateTreeNode&lt;...&gt;; }&gt; &#124; null</code></pre></dialog></span> |  |
| <span id="getter-adapterconfig">**adapterConfig**</span><br><code>Record&lt;string, unknown&gt;</code> |  |
| <span id="getter-isminimized">**isMinimized**</span><br><code>boolean</code> | Returns true if the parent track is minimized. Used to skip expensive operations like autoruns when track is not visible. |
| <span id="getter-hoveredfeature">**hoveredFeature**</span><br><code>unknown</code> | Overridable hook (default `undefined`): what the pointer is currently over, for readers **outside** the display. `LinearGenomeViewContainer` publishes it to `session.hovered`, the view-wide "what is the user pointing at" channel a plugin can subscribe to.<br><br>Declared here because a cross-display consumer can only read a name the base declares — the same reason `SyntenyFetchStateMixin.fetchInert` is a hook rather than a getter each display invents. The container used to read `featureUnderMouse`, which only the wiggle, alignments and Manhattan families spelled that way — canvas said `hoveredFeature`, variants `hoveredGenotype` — so the channel carried a hover from a third of the display types and nothing said which. It also asked only `displays[0]` of each track.<br><br>`unknown` because the payload genuinely differs — a read, a wiggle bin, a SNP, a genotype cell — and `session.hovered` is typed to match ("can be anything; code that wants to deal with this should examine it"). Narrow it in the override. |
| <span id="getter-effectiverpcdrivername">**effectiveRpcDriverName**</span><br><code>any</code> | Returns the effective RPC driver name with hierarchical fallback: 1. This display's explicit rpcDriverName 2. Parent display's effectiveRpcDriverName (for nested displays) 3. Track config's rpcDriverName |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-renderingprops">**renderingProps**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;{ id: IOptionalITy…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;{ id: IOptionalIType&lt;…&gt;; type: ISimpleType&lt;…&gt;; rpcDriverName: IMaybe&lt;…&gt;; }&gt; &amp; { ...; } &amp; { ...; } &amp; { ...; } &amp; IStateTreeNode&lt;...&gt;; }</code></pre></dialog></span> | props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setstatusmessage">**setStatusMessage**</span><br><code>(status?: RpcStatus &#124; undefined) =&gt; void</code> |  |
| <span id="action-seterror">**setError**</span><br><code>(error?: unknown) =&gt; void</code> |  |
| <span id="action-setrpcdrivername">**setRpcDriverName**</span><br><code>(rpcDriverName: string) =&gt; void</code> |  |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | base display reload does nothing, see specialized displays for details |
