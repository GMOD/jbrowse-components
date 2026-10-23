---
id: basedisplay
title: BaseDisplay
description: "Holds a display's parent track, the adapter config read from that track, its load status and error, and the component that draws it. Every display composes this model."
sidebar_label: Display -> BaseDisplay
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseDisplayModel.tsx).

Holds a display's parent track, the adapter config read from that track, its
load status and error, and the component that draws it. Every display
composes this model.

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
| <span id="volatile-error">**error**</span><br><code>unknown</code> |  |
| <span id="volatile-statusmessage">**statusMessage**</span><br><code>string &#124; undefined</code> |  |
| <span id="volatile-statusprogress">**statusProgress**</span><br><code>number &#124; undefined</code> | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate. Set alongside `statusMessage` by `setStatusMessage`; a display that never shows a bar simply leaves it undefined. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-parenttrack">**parentTrack**</span><br><code>AbstractTrackModel</code> |  |
| <span id="getter-renderingcomponent">**RenderingComponent**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>React.FC&lt;{ model: typeof self; onHorizontalScroll?: (distance:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>React.FC&lt;{ model: typeof self; onHorizontalScroll?: (distance: number) =&gt; void; blockState?: Record&lt;string, unknown&gt;; }&gt;</code></pre></dialog></span> |  |
| <span id="getter-displayblurb">**DisplayBlurb**</span><br><code>React.FC&lt;{ model: typeof self; }&gt; &#124; null</code> |  |
| <span id="getter-adapterconfig">**adapterConfig**</span><br><code>Record&lt;string, unknown&gt;</code> |  |
| <span id="getter-isminimized">**isMinimized**</span><br><code>boolean</code> | Returns true if the parent track is minimized. Used to skip expensive operations like autoruns when track is not visible. |
| <span id="getter-hoveredfeature">**hoveredFeature**</span><br><code>unknown</code> | Overridable hook (default `undefined`): what the pointer is currently over, for readers **outside** the display. `LinearGenomeViewContainer` publishes it to `session.hovered`, the view-wide "what is the user pointing at" channel a plugin can subscribe to.<br><br>Declared here because a cross-display consumer can only read a name the base declares — the same reason `FetchMixin.fetchInert` is a hook rather than a getter each display invents.<br><br>`unknown` because the payload genuinely differs — a read, a wiggle bin, a SNP, a genotype cell — and `session.hovered` is typed to match ("can be anything; code that wants to deal with this should examine it"). Narrow it in the override. |
| <span id="getter-featurenoun">**featureNoun**</span><br><code>string</code> | Overridable hook (default `'feature'`): the singular word for one of the things this display draws, as a menu row or a chip says it — "Hide this read", "Showing 3 variants".<br><br>Declared here for the same reason as `hoveredFeature` above: it is read across the display boundary, by chrome that does not know which display it is drawing for (`SoloSelectionChip`, alignments' group-label overlay), and a name only the base declares is a name every such consumer can rely on.<br><br>**A control keeps the generic word; content takes this one.** "Variant height" reads as a different setting from "Feature height" when it is the same one, so the shared menus stay on "feature" however the display answers here, and the noun varies where it names what the user is looking at — "Showing 3 variants", "Hide this read". A display drawing something the generic word already fits is right to leave this alone.<br><br>Distinct from the per-hit noun a context menu takes off the clicked item's own `type` ("mRNA", "gene"); that names one annotation, this names what the track holds. The hit noun falls back to this. |
| <span id="getter-featurewidgettype">**featureWidgetType**</span><br><code>{ type: string; id: string; }</code> | The widget `openFeatureWidget` opens for one of this display's features. Displays may override it. The default is the generic feature widget, for displays drawing plain features.<br><br>Displays whose features are a specific kind (a read, a variant, a synteny block) override it, including the `id`: two displays naming one id share the drawer panel, which suits two displays showing the same kind of feature. |
| <span id="getter-livenotices">**liveNotices**</span><br><code>string[]</code> | Notices from the loaded data beside the config, such as a field no fetched feature has. Empty unless a display overrides it. |
| <span id="getter-plotkeys">**plotKeys**</span><br><code>string[]</code> | The grammar settings this display's config declares with `plot` (`plotKeysOf`): what "Edit plot..." edits. Empty on a display with none, which then offers no editor. |
| <span id="getter-plot">**plot**</span><br><code>Plot</code> | Those settings as declared, defaults left off and a shorthand written as a config file writes it. An agent edits a `structuredClone` of it, checks it with `plotProblems` and hands it to `applyPlot`. |
| <span id="getter-confignotices">**configNotices**</span><br><code>string[]</code> | `configProblemsOf` the live config. |
| <span id="getter-notices">**notices**</span><br><code>string[]</code> | Every line the display has to say about what it cannot draw as written, as an agent's settle report reads them: `configNotices`, then `liveNotices`. |
| <span id="getter-cornernotices">**cornerNotices**</span><br><code>string[]</code> | The lines the display chrome's corner chip lists: `notices`, less any a display shows in a separate chip. |
| <span id="getter-plotexamples">**plotExamples**</span><br><code>readonly PlotExample[]</code> | The worked examples this display type declares, which "Edit plot..." offers as buttons. |
| <span id="getter-configdocsurl">**configDocsUrl**</span><br><code>string</code> | This display type's page in the config reference, which lists every setting it takes. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-renderingprops">**renderingProps**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; { readonly RenderingComponent: FC&lt;…&gt;; readonly DisplayBlurb: FC&lt;{ model: ModelInstanceTypeProps&lt;{ id: IOptionalIType&lt;ISimpleType&lt;…&gt;, [undefined]&gt;; type: ISimpleType&lt;string&gt;; }&gt; &amp; { error: unknown; statusMessage: string &#124; undefined; statusProgress: number &#124; undefined; } &amp; { readonly parentTrack: AbstractTrackModel; }; }&gt; &#124; null; readonly adapterConfig: Record&lt;string, unknown&gt;; readonly isMinimized: boolean; readonly hoveredFeature: unknown; readonly featureNoun: string; readonly featureWidgetType: { type: string; id: string; }; }; }</code></pre></dialog></span> | props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |
| <span id="method-configproblemsof">**configProblemsOf**</span><br><code>(conf: AnyConfigurationModel) =&gt; string[]</code> | The problems in a config that cannot be drawn as written: by default the schema's rules over its color objects and value axes, the ones `jbrowse validate` runs. A display with additional rules overrides it. `plotProblems` asks it of a draft and `notices` of the live config, so Edit plot and the corner never disagree. |
| <span id="method-liftplot">**liftPlot**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(draft: Plot, options?: PlotWriteOptions &#124; undefined) =&gt; AnyCon…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(draft: Plot, options?: PlotWriteOptions &#124; undefined) =&gt; AnyConfigurationModel</code></pre></dialog></span> | A draft as the config would hold it, merged over `plot`, throwing what a config file would be refused for. It leaves the display unchanged. |
| <span id="method-plotproblems">**plotProblems**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(draft: Plot, options?: PlotWriteOptions &#124; undefined) =&gt; string…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(draft: Plot, options?: PlotWriteOptions &#124; undefined) =&gt; string[]</code></pre></dialog></span> | What a draft would report once applied, throwing a refusal as `liftPlot` does: `configProblemsOf` the lifted draft. The draft still applies, and draws what it can. |
| <span id="method-plotwrites">**plotWrites**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(draft: Plot, options?: PlotWriteOptions &#124; undefined) =&gt; Record…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(draft: Plot, options?: PlotWriteOptions &#124; undefined) =&gt; Record&lt;string, unknown&gt;</code></pre></dialog></span> | What applying a draft would write, by setting: the lifted value where it differs from `plot`, `null` where it resets one. Throws a refusal. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setstatusmessage">**setStatusMessage**</span><br><code>(status?: RpcStatus &#124; undefined) =&gt; void</code> |  |
| <span id="action-seterror">**setError**</span><br><code>(error?: unknown) =&gt; void</code> |  |
| <span id="action-clearhoveredfeature">**clearHoveredFeature**</span><br><code>() =&gt; void</code> | Overridable hook (default no-op): drop whatever `hoveredFeature` reports. The writing twin of that getter, and what `installClearHoverOnViewportChange` calls.<br><br>A display that stores its hover owes an override; one that derives it from the live pointer (Hi-C, LD) owes nothing, and the default costs it nothing. Declared here so the clear can be installed for every display rather than remembered per display — forgetting it is the failure ARCHITECTURE.md's stored-hover section is about. |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | base display reload does nothing, see specialized displays for details |
| <span id="action-applydisplaysettings">**applyDisplaySettings**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(settings: Record&lt;string, unknown&gt;, options?: { allowSetters?:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(settings: Record&lt;string, unknown&gt;, options?: { allowSetters?: boolean &#124; undefined; } &#124; undefined) =&gt; { applied: string[]; unapplied: UnappliedSetting[]; failed: { key: string; error: string; }[]; }</code></pre></dialog></span> | Apply a set of display settings to the live display, and report which were applied. Each key runs through the display config schema's `preProcessSnapshot` (shorthand expansions and legacy-key migrations, as `showTrackGeneric` applies to a session spec's inline track keys), then writes the matching config slot. A key naming a channel (`facet`, `color`, `rows`, any object declaring `writes: 'whole'`) replaces the whole object, its shorthand lifted by that schema, and `null` clears it; any other object, `encoding` among them, names members inside it and leaves the rest. Keys that are not slots come back in `unapplied` as `{ key, reason }`, so a caller can tell a misspelling from a key that has an action instead of a slot.<br><br>`allowSetters` also routes a non-slot key to a single-argument action named `set<Key>`. It is off by default because session specs, share links and embeds pass untyped JSON here, and a default fallback would let them call internal setters (`setError`, `setScrollTop`, ...) and call multi-argument setters with one argument. A caller that wants a specific action can call it directly.<br><br>A key whose write threw is reported in `failed`. Only `failed` means the caller passed a bad value. `unapplied` needs the caller's own context to read: `showTrackGeneric` spreads the same settings into the display's snapshot, so a declared prop (`resolution`) has already landed by the time it reports here, while the restyle path spreads nothing and every entry there did nothing.<br><br>A per-key error does not abort the remaining keys. A caller mid-`showTrack` has already pushed the track, and one rejected value should not leave it half-configured. |
| <span id="action-applyplot">**applyPlot**</span><br><code>(draft: Plot, options?: PlotWriteOptions &#124; undefined) =&gt; void</code> | Write a draft over `plot` as a settings bag writes: a setting left out stays, `null` resets one, a channel (`writes: 'whole'`, such as `color` or `facet`) is replaced whole, and any other object takes the members the draft names, so a `filter` list keeps the filter's other tests. Under `whole` the draft is the plot entire, as the "Edit plot..." text is: a setting it leaves out resets. A draft the schema refuses, or naming a setting outside the plot, throws before anything is written. |
