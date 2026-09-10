---
id: chordsyntenydisplay
title: ChordSyntenyDisplay
sidebar_label: Display -> ChordSyntenyDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordSyntenyDisplay/models/stateModelFactory.ts).

## Example usage

The circular-view display for a `SyntenyTrack`: each alignment is drawn as a
ribbon between its span on one side and its mate's span on the other, so an
inversion reads as a twist. The track config below is what creates it; its
colors are the config slots on [](/docs/config/chordsyntenydisplay):

```js
{
  type: 'SyntenyTrack',
  trackId: 'volvox_self',
  name: 'Volvox self-alignment',
  assemblyNames: ['volvox', 'volvox'],
  adapter: {
    type: 'PAFAdapter',
    uri: 'https://example.com/volvox_self.paf',
    queryAssembly: 'volvox',
    targetAssembly: 'volvox',
  },
  displays: [
    {
      type: 'ChordSyntenyDisplay',
      displayId: 'volvox_self-ChordSyntenyDisplay',
    },
  ],
}
```

A track aligning two assemblies needs both of them on the circle, which is
the view's `assembly: ['hg38', 'mm39']` — see the
[synteny track guide](/docs/config_guides/synteny_track).

The configuration slots for this model are documented on its [config schema page](../../config/chordsyntenydisplay).

Members a composed model contributes are listed here too, so these tables are the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('ChordSyntenyDisplay')</code> |  | ChordSyntenyDisplay |
| <span id="property-bezierradiusratio">**bezierRadiusRatio**</span><br><code>bezierRadiusRatio: types.stripDefault(types.number, 0.1)</code> |  | ChordSyntenyDisplay |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  | ChordSyntenyDisplay |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | [BaseDisplay](../basedisplay#property-id) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-features">**features**</span><br><code>features: undefined as Feature[] &#124; undefined</code> |  | ChordSyntenyDisplay |
| <span id="volatile-adapternames">**adapterNames**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>adapterNames: undefined as Record&lt;string, AdapterNames&gt; &#124; undef…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>adapterNames: undefined as Record&lt;string, AdapterNames&gt; &#124; undefined</code></pre></dialog></span> | one entry per assembly the circle draws, keyed by the canonical name | ChordSyntenyDisplay |
| <span id="volatile-reloadcounter">**reloadCounter**</span><br><code>reloadCounter: 0</code> | pure "go again" signal for the fetch autorun, the same role `reloadCounter` plays in the three fetch families | ChordSyntenyDisplay |
| <span id="volatile-error">**error**</span><br><code>error: undefined as unknown</code> |  | [BaseDisplay](../basedisplay#volatile-error) |
| <span id="volatile-statusmessage">**statusMessage**</span><br><code>statusMessage: undefined as string &#124; undefined</code> |  | [BaseDisplay](../basedisplay#volatile-statusmessage) |
| <span id="volatile-statusprogress">**statusProgress**</span><br><code>statusProgress: undefined as number &#124; undefined</code> | <span data-pagefind-ignore>determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate. Set alongside `statusMessage` by `setStatusMessage`; a display that never shows a bar simply leaves it undefined.</span> | [BaseDisplay](../basedisplay#volatile-statusprogress) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;_OverrideProps&lt;{ id: IOptionalIType&lt;…&gt;;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;_OverrideProps&lt;{ id: IOptionalIType&lt;…&gt;; displayName: IMaybe&lt;…&gt;; minimized: IOptionalIType&lt;…&gt;; }, { ...; }&gt;&gt; &amp; ... 11 more ... &amp; IStateTreeNode&lt;...&gt;</code></pre></dialog></span> |  | ChordSyntenyDisplay |
| <span id="getter-fetchinert">**fetchInert**</span><br><code>boolean</code> | Same name and same meaning as `FetchMixin.fetchInert`, on a display that does not compose it: the fetch autorun never runs while the view holds no displayed regions, so a track opened from the import form's track selector rests forever in "fetch not started". The SVG export's unbounded `when` and the retry-contract check both read it. | ChordSyntenyDisplay |
| <span id="getter-ready">**ready**</span><br><code>boolean</code> | both halves of a ribbon render: the alignments, and the per-assembly name tables that place each of their two ends | ChordSyntenyDisplay |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | Off-screen SVG export gate, on the same shared `computeSvgReady` policy as every other display. A radial display has no box to draw an error in, so `awaitSvgReady` fails the export rather than exporting a message. | ChordSyntenyDisplay |
| <span id="getter-displayphase">**displayPhase**</span><br><code>DisplayStatusPhase</code> |  | ChordSyntenyDisplay |
| <span id="getter-radiuspx">**radiusPx**</span><br><code>number</code> |  | ChordSyntenyDisplay |
| <span id="getter-bezierradius">**bezierRadius**</span><br><code>number</code> | the deepest a ribbon bows toward the center, which one straight across the circle reaches — see `chordControlRadius` | ChordSyntenyDisplay |
| <span id="getter-sliceindex">**sliceIndex**</span><br><code>Record&lt;string, Slice&gt;</code> | every slice of the circle, keyed by the assembly AND refName a feature off this display's adapter carries. Both halves are needed: a two- assembly circle can carry a `chr1` twice, and a refName-keyed table answers whichever slice was written last. An elided slice answers to each of the refNames it swallowed. | ChordSyntenyDisplay |
| <span id="getter-selectedfeatureid">**selectedFeatureId**</span><br><code>string &#124; undefined</code> |  | ChordSyntenyDisplay |
| <span id="getter-featurenoun">**featureNoun**</span><br><code>string</code> |  | ChordSyntenyDisplay |
| <span id="getter-featurewidgettype">**featureWidgetType**</span><br><code>{ type: string; id: string; }</code> | the panel the linear synteny displays open for the same record, so a ribbon clicked on the circle and a ribbon clicked in a synteny view share one drawer entry | ChordSyntenyDisplay |
| <span id="getter-parenttrack">**parentTrack**</span><br><code>AbstractTrackModel</code> |  | [BaseDisplay](../basedisplay#getter-parenttrack) |
| <span id="getter-renderingcomponent">**RenderingComponent**</span><br><code>FC&lt;…&gt;</code> |  | [BaseDisplay](../basedisplay#getter-renderingcomponent) |
| <span id="getter-displayblurb">**DisplayBlurb**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>FC&lt;{ model: ModelInstanceTypeProps&lt;{ id: IOptionalIType&lt;ISimple…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>FC&lt;{ model: ModelInstanceTypeProps&lt;{ id: IOptionalIType&lt;ISimpleType&lt;string&gt;, [undefined]&gt;; type: ISimpleType&lt;string&gt;; }&gt; &amp; { ...; } &amp; { ...; } &amp; IStateTreeNode&lt;...&gt;; }&gt; &#124; null</code></pre></dialog></span> |  | [BaseDisplay](../basedisplay#getter-displayblurb) |
| <span id="getter-adapterconfig">**adapterConfig**</span><br><code>Record&lt;string, unknown&gt;</code> |  | [BaseDisplay](../basedisplay#getter-adapterconfig) |
| <span id="getter-isminimized">**isMinimized**</span><br><code>boolean</code> | <span data-pagefind-ignore>Returns true if the parent track is minimized. Used to skip expensive operations like autoruns when track is not visible.</span> | [BaseDisplay](../basedisplay#getter-isminimized) |
| <span id="getter-hoveredfeature">**hoveredFeature**</span><br><code>unknown</code> | <span data-pagefind-ignore>Overridable hook (default `undefined`): what the pointer is currently over, for readers **outside** the display. `LinearGenomeViewContainer` publishes it to `session.hovered`, the view-wide "what is the user pointing at" channel a plugin can subscribe to.<br><br>Declared here because a cross-display consumer can only read a name the base declares — the same reason `FetchMixin.fetchInert` is a hook rather than a getter each display invents. The container used to read `featureUnderMouse`, which only the wiggle, alignments and Manhattan families spelled that way — canvas said `hoveredFeature`, variants `hoveredGenotype` — so the channel carried a hover from a third of the display types and nothing said which. It also asked only `displays[0]` of each track.<br><br>`unknown` because the payload genuinely differs — a read, a wiggle bin, a SNP, a genotype cell — and `session.hovered` is typed to match ("can be anything; code that wants to deal with this should examine it"). Narrow it in the override.</span> | [BaseDisplay](../basedisplay#getter-hoveredfeature) |

## Methods

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="method-slicefor">**sliceFor**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(assemblyName: string &#124; undefined, refName: string) =&gt; Slice &#124;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(assemblyName: string &#124; undefined, refName: string) =&gt; Slice &#124; undefined</code></pre></dialog></span> | the slice one end of an alignment lands on. The assembly falls back to the circle's only one, for an adapter that leaves it off a mate. | ChordSyntenyDisplay |
| <span id="method-rendersvg">**renderSvg**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(_opts: ExportSvgOptions &amp; { theme?: ThemeOptions &#124; undefined;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(_opts: ExportSvgOptions &amp; { theme?: ThemeOptions &#124; undefined; }) =&gt; Promise&lt;Element &#124; null&gt;</code></pre></dialog></span> |  | ChordSyntenyDisplay |
| <span id="method-renderingprops">**renderingProps**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;{ id: IOptionalITy…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;{ id: IOptionalIType&lt;…&gt;; type: ISimpleType&lt;string&gt;; }&gt; &amp; { ...; } &amp; { ...; } &amp; { ...; } &amp; IStateTreeNode&lt;...&gt;; }</code></pre></dialog></span> | <span data-pagefind-ignore>props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks</span> | [BaseDisplay](../basedisplay#method-renderingprops) |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  | [BaseDisplay](../basedisplay#method-trackmenuitems) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-onribbonclick">**onRibbonClick**</span><br><code>(feature: Feature) =&gt; void</code> |  | ChordSyntenyDisplay |
| <span id="action-openerrordialog">**openErrorDialog**</span><br><code>() =&gt; void</code> |  | ChordSyntenyDisplay |
| <span id="action-setfeatures">**setFeatures**</span><br><code>(features: Feature[] &#124; undefined) =&gt; void</code> |  | ChordSyntenyDisplay |
| <span id="action-setadapternames">**setAdapterNames**</span><br><code>(names: Record&lt;string, AdapterNames&gt; &#124; undefined) =&gt; void</code> |  | ChordSyntenyDisplay |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> |  | ChordSyntenyDisplay |
| <span id="action-setstatusmessage">**setStatusMessage**</span><br><code>(status?: RpcStatus &#124; undefined) =&gt; void</code> |  | [BaseDisplay](../basedisplay#action-setstatusmessage) |
| <span id="action-seterror">**setError**</span><br><code>(error?: unknown) =&gt; void</code> |  | [BaseDisplay](../basedisplay#action-seterror) |
| <span id="action-clearhoveredfeature">**clearHoveredFeature**</span><br><code>() =&gt; void</code> | <span data-pagefind-ignore>Overridable hook (default no-op): drop whatever `hoveredFeature` reports. The writing twin of that getter, and what `installClearHoverOnViewportChange` calls.<br><br>A display that STORES its hover owes an override; one that derives it from the live pointer (MAF, Hi-C, LD) owes nothing, and the default costs it nothing. Declared here so the clear can be installed for every display rather than remembered per display — forgetting it is the failure ARCHITECTURE.md's stored-hover section is about, and it used to be six closures at six call sites, which is six chances to omit one.</span> | [BaseDisplay](../basedisplay#action-clearhoveredfeature) |
| <span id="action-applydisplaysettings">**applyDisplaySettings**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(settings: Record&lt;…&gt;, options?: { allowSetters?: boolean &#124; unde…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(settings: Record&lt;…&gt;, options?: { allowSetters?: boolean &#124; undefined; } &#124; undefined) =&gt; { applied: string[]; unapplied: string[]; failed: { key: string; error: string; }[]; }</code></pre></dialog></span> | <span data-pagefind-ignore>Apply a bag of display settings to the LIVE display, and report what landed. Each key runs through the display config schema's `preProcessSnapshot` (shorthand expansions, legacy-key migrations — the same lowering a session spec's inline track keys get in `showTrackGeneric`), then writes the matching config slot. Keys that are not slots come back in `unapplied` rather than vanishing: the settings vocabulary's historical failure mode is the silently dropped key.<br><br>`allowSetters` additionally routes a non-slot key to a conventionally named single-argument `set<Key>` action. Opt-in, never the default: the declarative surfaces (session specs, share links, embeds) feed this whole bags of untyped JSON, and a blanket fallback would let them reach internal setters (`setError`, `setScrollTop`, ...) and call multi-argument setters with one argument. A caller that wants a specific action can also simply call it.<br><br>A key whose write THREW is reported separately, in `failed` — it is the only one of the three that means the caller got something wrong, and the only one worth a notification. `unapplied` is not: at the `showTrackGeneric` call site it also collects keys that surface consumed itself (`type`) and MST display props the display snapshot already applied (`resolution`), so treating it as "dropped" would report a correct call as broken.<br><br>Per-key errors do not abort the rest of the bag — a caller mid-`showTrack` has already pushed the track, and one rejected value must not strand a half-configured track.</span> | [BaseDisplay](../basedisplay#action-applydisplaysettings) |
