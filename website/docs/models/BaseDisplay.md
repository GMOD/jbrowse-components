---
id: basedisplay
title: BaseDisplay
sidebar_label: Display -> BaseDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseDisplayModel.tsx).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.string</code> |  |

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
| <span id="getter-renderingcomponent">**RenderingComponent**</span><br><code>FC&lt;…&gt;</code> |  |
| <span id="getter-displayblurb">**DisplayBlurb**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>FC&lt;{ model: ModelInstanceTypeProps&lt;{ id: IOptionalIType&lt;ISimple…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>FC&lt;{ model: ModelInstanceTypeProps&lt;{ id: IOptionalIType&lt;ISimpleType&lt;string&gt;, [undefined]&gt;; type: ISimpleType&lt;string&gt;; }&gt; &amp; { ...; } &amp; { ...; } &amp; IStateTreeNode&lt;...&gt;; }&gt; &#124; null</code></pre></dialog></span> |  |
| <span id="getter-adapterconfig">**adapterConfig**</span><br><code>Record&lt;string, unknown&gt;</code> |  |
| <span id="getter-isminimized">**isMinimized**</span><br><code>boolean</code> | Returns true if the parent track is minimized. Used to skip expensive operations like autoruns when track is not visible. |
| <span id="getter-hoveredfeature">**hoveredFeature**</span><br><code>unknown</code> | Overridable hook (default `undefined`): what the pointer is currently over, for readers **outside** the display. `LinearGenomeViewContainer` publishes it to `session.hovered`, the view-wide "what is the user pointing at" channel a plugin can subscribe to.<br><br>Declared here because a cross-display consumer can only read a name the base declares — the same reason `SyntenyFetchStateMixin.fetchInert` is a hook rather than a getter each display invents. The container used to read `featureUnderMouse`, which only the wiggle, alignments and Manhattan families spelled that way — canvas said `hoveredFeature`, variants `hoveredGenotype` — so the channel carried a hover from a third of the display types and nothing said which. It also asked only `displays[0]` of each track.<br><br>`unknown` because the payload genuinely differs — a read, a wiggle bin, a SNP, a genotype cell — and `session.hovered` is typed to match ("can be anything; code that wants to deal with this should examine it"). Narrow it in the override. |
| <span id="getter-featurenoun">**featureNoun**</span><br><code>string</code> | Overridable hook (default `'feature'`): the SINGULAR word for one of the things this display draws, as a menu row or a chip says it — "Hide this read", "Showing 3 variants".<br><br>Declared here for the same reason as `hoveredFeature` above: it is read across the display boundary, by chrome that has no idea which display it is drawing for (`SoloSelectionChip`, alignments' group-label overlay), and a name only the base declares is a name every such consumer can rely on. Two displays declared it independently and one of those declarations WAS this default.<br><br>**A control keeps the generic word; content takes this one.** "Variant height" reads as a different setting from "Feature height" when it is the same one, so the shared menus stay on "feature" however the display answers here, and the noun varies where it names what the user is looking at — "Showing 3 variants", "Hide this read". A display drawing something the generic word already fits is right to leave this alone.<br><br>Distinct from the per-hit noun a context menu takes off the clicked item's own `type` ("mRNA", "gene"); that names one annotation, this names what the track holds. The hit noun falls back to this. |
| <span id="getter-featurewidgettype">**featureWidgetType**</span><br><code>{ type: string; id: string; }</code> | Overridable hook: which widget `openFeatureWidget` opens for one of this display's features. The default is the generic one, which is what a display drawing plain features wants and what the canvas base spelled out by hand.<br><br>An override is a display whose features have a vocabulary of their own — a read, a variant, a synteny block — and the `id` is deliberately part of it: two displays naming one id share the drawer panel, which is the behaviour when the two are showing the same kind of thing. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-renderingprops">**renderingProps**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;{ id: IOptionalITy…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;{ id: IOptionalIType&lt;…&gt;; type: ISimpleType&lt;string&gt;; }&gt; &amp; { ...; } &amp; { ...; } &amp; { ...; } &amp; IStateTreeNode&lt;...&gt;; }</code></pre></dialog></span> | props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setstatusmessage">**setStatusMessage**</span><br><code>(status?: RpcStatus &#124; undefined) =&gt; void</code> |  |
| <span id="action-seterror">**setError**</span><br><code>(error?: unknown) =&gt; void</code> |  |
| <span id="action-clearhoveredfeature">**clearHoveredFeature**</span><br><code>() =&gt; void</code> | Overridable hook (default no-op): drop whatever `hoveredFeature` reports. The writing twin of that getter, and what `installClearHoverOnViewportChange` calls.<br><br>A display that STORES its hover owes an override; one that derives it from the live pointer (MAF, Hi-C, LD) owes nothing, and the default costs it nothing. Declared here so the clear can be installed for every display rather than remembered per display — forgetting it is the failure ARCHITECTURE.md's stored-hover section is about, and it used to be six closures at six call sites, which is six chances to omit one. |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | base display reload does nothing, see specialized displays for details |
