---
id: chordvariantdisplay
title: ChordVariantDisplay
sidebar_label: Display -> ChordVariantDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`circular-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordVariantDisplay/models/stateModelFactory.ts).

## Example usage

The circular-view display for a `VariantTrack` of structural variants;
translocations are drawn as chords across the circle. `bezierRadiusRatio` sets
the deepest bow toward the center, which a chord straight across the circle
reaches; a shorter-range one bows in proportion to its span:

```js
{
  type: 'VariantTrack',
  trackId: 'sv',
  name: 'Structural variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/sv.vcf.gz',
  },
  displays: [
    {
      type: 'ChordVariantDisplay',
      displayId: 'sv-ChordVariantDisplay',
      bezierRadiusRatio: 0.1,
    },
  ],
}
```

The configuration slots for this model are documented on its
[config schema page](../../config/chordvariantdisplay).

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('ChordVariantDisplay')</code> |  | ChordVariantDisplay |
| <span id="property-bezierradiusratio">**bezierRadiusRatio**</span><br><code>bezierRadiusRatio: types.stripDefault(types.number, 0.1)</code> |  | ChordVariantDisplay |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  | ChordVariantDisplay |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | [BaseDisplay](../basedisplay#property-id) |
| <span id="property-rpcdrivername">**rpcDriverName**</span><br><code>rpcDriverName: types.maybe(types.string)</code> |  | [BaseDisplay](../basedisplay#property-rpcdrivername) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-features">**features**</span><br><code>features: undefined as Feature[] &#124; undefined</code> |  | ChordVariantDisplay |
| <span id="volatile-refnamemap">**refNameMap**</span><br><code>refNameMap: undefined as Record&lt;string, string&gt; &#124; undefined</code> |  | ChordVariantDisplay |
| <span id="volatile-error">**error**</span><br><code>error: undefined as unknown</code> |  | [BaseDisplay](../basedisplay#volatile-error) |
| <span id="volatile-statusmessage">**statusMessage**</span><br><code>statusMessage: undefined as string &#124; undefined</code> |  | [BaseDisplay](../basedisplay#volatile-statusmessage) |
| <span id="volatile-statusprogress">**statusProgress**</span><br><code>statusProgress: undefined as number &#124; undefined</code> | <span data-pagefind-ignore>determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate. Set alongside `statusMessage` by `setStatusMessage`; a display that never shows a bar simply leaves it undefined.</span> | [BaseDisplay](../basedisplay#volatile-statusprogress) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;_OverrideProps&lt;{ id: IOptionalIType&lt;…&gt;;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;_OverrideProps&lt;{ id: IOptionalIType&lt;…&gt;; displayName: IMaybe&lt;…&gt;; minimized: IOptionalIType&lt;…&gt;; }, { ...; }&gt;&gt; &amp; ... 10 more ... &amp; IStateTreeNode&lt;...&gt;</code></pre></dialog></span> |  | ChordVariantDisplay |
| <span id="getter-ready">**ready**</span><br><code>boolean</code> | both halves of a chord render: the features, and the refName map that translates the assembly's names to the adapter's. `blocksForRefs` falls back to untranslated names while the map is in flight, so a render that only waited on features could draw a figure with every chord silently dropped (whenever the adapter names differ, e.g. `1` vs `chr1`). | ChordVariantDisplay |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | Off-screen SVG export gate: "Export SVG" waits on this before drawing (see the [SVG export guide](/docs/developer_guides/svg_export)). Chord displays are non-rectangular (radial), so on screen they keep a bespoke `<DisplayError>` error UI instead of `SvgChrome`; the export has no box to draw one in either, and doesn't try — `awaitSvgReady` fails the export on a chord track that wouldn't load. Same shared `computeSvgReady` policy as every other display, awaited the same shared way — no inlined `when()`. No `regionTooLarge` state, and a chord fetch covers the whole view at once, so `ready` (features and refName map arrived) is the whole freshness axis. | ChordVariantDisplay |
| <span id="getter-radiuspx">**radiusPx**</span><br><code>number</code> |  | ChordVariantDisplay |
| <span id="getter-bezierradius">**bezierRadius**</span><br><code>number</code> | the deepest a chord bows toward the center, which a chord straight across the circle reaches. A shorter one bows in proportion to how far apart its ends are — see `chordControlRadius` | ChordVariantDisplay |
| <span id="getter-blocksforrefs">**blocksForRefs**</span><br><code>Record&lt;string, Slice&gt;</code> | every slice of the circle, keyed by the refName a feature off this display's adapter carries. An elided slice answers to each of the refNames it swallowed | ChordVariantDisplay |
| <span id="getter-selectedfeatureid">**selectedFeatureId**</span><br><code>string &#124; undefined</code> |  | ChordVariantDisplay |
| <span id="getter-parenttrack">**parentTrack**</span><br><code>AbstractTrackModel</code> |  | [BaseDisplay](../basedisplay#getter-parenttrack) |
| <span id="getter-parentdisplay">**parentDisplay**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ type?: string &#124; undefined; effectiveRpcDriverName?: string &#124;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ type?: string &#124; undefined; effectiveRpcDriverName?: string &#124; undefined; } &#124; undefined</code></pre></dialog></span> | <span data-pagefind-ignore>Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)</span> | [BaseDisplay](../basedisplay#getter-parentdisplay) |
| <span id="getter-renderingcomponent">**RenderingComponent**</span><br><code>FC&lt;…&gt;</code> |  | [BaseDisplay](../basedisplay#getter-renderingcomponent) |
| <span id="getter-displayblurb">**DisplayBlurb**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>FC&lt;{ model: ModelInstanceTypeProps&lt;{ id: IOptionalIType&lt;…&gt;; typ…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>FC&lt;{ model: ModelInstanceTypeProps&lt;{ id: IOptionalIType&lt;…&gt;; type: ISimpleType&lt;…&gt;; rpcDriverName: IMaybe&lt;ISimpleType&lt;…&gt;&gt;; }&gt; &amp; { ...; } &amp; { ...; } &amp; IStateTreeNode&lt;...&gt;; }&gt; &#124; null</code></pre></dialog></span> |  | [BaseDisplay](../basedisplay#getter-displayblurb) |
| <span id="getter-adapterconfig">**adapterConfig**</span><br><code>Record&lt;string, unknown&gt;</code> |  | [BaseDisplay](../basedisplay#getter-adapterconfig) |
| <span id="getter-isminimized">**isMinimized**</span><br><code>boolean</code> | <span data-pagefind-ignore>Returns true if the parent track is minimized. Used to skip expensive operations like autoruns when track is not visible.</span> | [BaseDisplay](../basedisplay#getter-isminimized) |
| <span id="getter-hoveredfeature">**hoveredFeature**</span><br><code>unknown</code> | <span data-pagefind-ignore>Overridable hook (default `undefined`): what the pointer is currently over, for readers **outside** the display. `LinearGenomeViewContainer` publishes it to `session.hovered`, the view-wide "what is the user pointing at" channel a plugin can subscribe to.<br><br>Declared here because a cross-display consumer can only read a name the base declares — the same reason `SyntenyFetchStateMixin.fetchInert` is a hook rather than a getter each display invents. The container used to read `featureUnderMouse`, which only the wiggle, alignments and Manhattan families spelled that way — canvas said `hoveredFeature`, variants `hoveredGenotype` — so the channel carried a hover from a third of the display types and nothing said which. It also asked only `displays[0]` of each track.<br><br>`unknown` because the payload genuinely differs — a read, a wiggle bin, a SNP, a genotype cell — and `session.hovered` is typed to match ("can be anything; code that wants to deal with this should examine it"). Narrow it in the override.</span> | [BaseDisplay](../basedisplay#getter-hoveredfeature) |
| <span id="getter-featurenoun">**featureNoun**</span><br><code>string</code> | <span data-pagefind-ignore>Overridable hook (default `'feature'`): the SINGULAR word for one of the things this display draws, as a menu row or a chip says it — "Hide this read", "Showing 3 variants".<br><br>Declared here for the same reason as `hoveredFeature` above: it is read across the display boundary, by chrome that has no idea which display it is drawing for (`SoloSelectionChip`, alignments' group-label overlay), and a name only the base declares is a name every such consumer can rely on. Two displays declared it independently and one of those declarations WAS this default.<br><br>**A control keeps the generic word; content takes this one.** "Variant height" reads as a different setting from "Feature height" when it is the same one, so the shared menus stay on "feature" however the display answers here, and the noun varies where it names what the user is looking at — "Showing 3 variants", "Hide this read". A display drawing something the generic word already fits is right to leave this alone.<br><br>Distinct from the per-hit noun a context menu takes off the clicked item's own `type` ("mRNA", "gene"); that names one annotation, this names what the track holds. The hit noun falls back to this.</span> | [BaseDisplay](../basedisplay#getter-featurenoun) |
| <span id="getter-featurewidgettype">**featureWidgetType**</span><br><code>{ type: string; id: string; }</code> | <span data-pagefind-ignore>Overridable hook: which widget `openFeatureWidget` opens for one of this display's features. The default is the generic one, which is what a display drawing plain features wants and what the canvas base spelled out by hand.<br><br>An override is a display whose features have a vocabulary of their own — a read, a variant, a synteny block — and the `id` is deliberately part of it: two displays naming one id share the drawer panel, which is the behaviour when the two are showing the same kind of thing.</span> | [BaseDisplay](../basedisplay#getter-featurewidgettype) |
| <span id="getter-effectiverpcdrivername">**effectiveRpcDriverName**</span><br><code>any</code> | <span data-pagefind-ignore>Returns the effective RPC driver name with hierarchical fallback: 1. This display's explicit rpcDriverName 2. Parent display's effectiveRpcDriverName (for nested displays) 3. Track config's rpcDriverName</span> | [BaseDisplay](../basedisplay#getter-effectiverpcdrivername) |

## Methods

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="method-rendersvg">**renderSvg**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(_opts: ExportSvgOptions &amp; { theme?: ThemeOptions &#124; undefined;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(_opts: ExportSvgOptions &amp; { theme?: ThemeOptions &#124; undefined; }) =&gt; Promise&lt;Element &#124; null&gt;</code></pre></dialog></span> |  | ChordVariantDisplay |
| <span id="method-renderingprops">**renderingProps**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;{ id: IOptionalITy…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;{ id: IOptionalIType&lt;…&gt;; type: ISimpleType&lt;…&gt;; rpcDriverName: IMaybe&lt;…&gt;; }&gt; &amp; { ...; } &amp; { ...; } &amp; { ...; } &amp; IStateTreeNode&lt;...&gt;; }</code></pre></dialog></span> | <span data-pagefind-ignore>props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks</span> | [BaseDisplay](../basedisplay#method-renderingprops) |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  | [BaseDisplay](../basedisplay#method-trackmenuitems) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-onchordclick">**onChordClick**</span><br><code>(feature: Feature) =&gt; void</code> |  | ChordVariantDisplay |
| <span id="action-openerrordialog">**openErrorDialog**</span><br><code>() =&gt; void</code> |  | ChordVariantDisplay |
| <span id="action-setfeatures">**setFeatures**</span><br><code>(features: Feature[] &#124; undefined) =&gt; void</code> |  | ChordVariantDisplay |
| <span id="action-setrefnamemap">**setRefNameMap**</span><br><code>(refNameMap: Record&lt;string, string&gt; &#124; undefined) =&gt; void</code> |  | ChordVariantDisplay |
| <span id="action-setstatusmessage">**setStatusMessage**</span><br><code>(status?: RpcStatus &#124; undefined) =&gt; void</code> |  | [BaseDisplay](../basedisplay#action-setstatusmessage) |
| <span id="action-seterror">**setError**</span><br><code>(error?: unknown) =&gt; void</code> |  | [BaseDisplay](../basedisplay#action-seterror) |
| <span id="action-clearhoveredfeature">**clearHoveredFeature**</span><br><code>() =&gt; void</code> | <span data-pagefind-ignore>Overridable hook (default no-op): drop whatever `hoveredFeature` reports. The writing twin of that getter, and what `installClearHoverOnViewportChange` calls.<br><br>A display that STORES its hover owes an override; one that derives it from the live pointer (MAF, Hi-C, LD) owes nothing, and the default costs it nothing. Declared here so the clear can be installed for every display rather than remembered per display — forgetting it is the failure ARCHITECTURE.md's stored-hover section is about, and it used to be six closures at six call sites, which is six chances to omit one.</span> | [BaseDisplay](../basedisplay#action-clearhoveredfeature) |
| <span id="action-setrpcdrivername">**setRpcDriverName**</span><br><code>(rpcDriverName: string) =&gt; void</code> |  | [BaseDisplay](../basedisplay#action-setrpcdrivername) |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | <span data-pagefind-ignore>base display reload does nothing, see specialized displays for details</span> | [BaseDisplay](../basedisplay#action-reload) |
