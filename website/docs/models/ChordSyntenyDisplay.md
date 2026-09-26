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
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  | ChordSyntenyDisplay |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | [BaseDisplay](../basedisplay#property-id) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-features">**features**</span><br><code>features: undefined as Feature[] &#124; undefined</code> |  | [BaseChordDisplay](../basechorddisplay#volatile-features) |
| <span id="volatile-reloadcounter">**reloadCounter**</span><br><code>reloadCounter: 0</code> | <span data-pagefind-ignore>the fetch's pure "go again" signal</span> | [BaseChordDisplay](../basechorddisplay#volatile-reloadcounter) |
| <span id="volatile-highlightedfeatureids">**highlightedFeatureIds**</span><br><code>highlightedFeatureIds: undefined as string[] &#124; undefined</code> | <span data-pagefind-ignore>ids of the features to keep at full strength while the rest dim; undefined dims nothing. The SV inspector writes the selected record's event here</span> | [BaseChordDisplay](../basechorddisplay#volatile-highlightedfeatureids) |
| <span id="volatile-visiblefeatureids">**visibleFeatureIds**</span><br><code>visibleFeatureIds: undefined as string[] &#124; undefined</code> | <span data-pagefind-ignore>ids of the features to draw; undefined draws them all. The SV inspector writes the rows its sheet's filters leave here, so a filter change is a redraw and no refetch</span> | [BaseChordDisplay](../basechorddisplay#volatile-visiblefeatureids) |
| <span id="volatile-error">**error**</span><br><code>error: undefined as unknown</code> |  | [BaseDisplay](../basedisplay#volatile-error) |
| <span id="volatile-statusmessage">**statusMessage**</span><br><code>statusMessage: undefined as string &#124; undefined</code> |  | [BaseDisplay](../basedisplay#volatile-statusmessage) |
| <span id="volatile-statusprogress">**statusProgress**</span><br><code>statusProgress: undefined as number &#124; undefined</code> | <span data-pagefind-ignore>determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate. Set alongside `statusMessage` by `setStatusMessage`; a display that never shows a bar simply leaves it undefined.</span> | [BaseDisplay](../basedisplay#volatile-statusprogress) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-ready">**ready**</span><br><code>boolean</code> | `loaded`, and no reorder this launch asked for still owed. Ribbons drawn before it would be drawn against the arcs it is about to move; a reorder that failed keeps this false and shows as `displayPhase` error, so a capture never commits the hairball | ChordSyntenyDisplay |
| <span id="getter-displayerror">**displayError**</span><br><code>unknown</code> | the fetch's error, or else the owed reorder's | ChordSyntenyDisplay |
| <span id="getter-featurenoun">**featureNoun**</span><br><code>string</code> |  | ChordSyntenyDisplay |
| <span id="getter-attributeranges">**attributeRanges**</span><br><code>Record&lt;string, AttributeRange&gt;</code> | the span or label list each colour channel covers over the held alignments, which the view's ramps and key scale to | ChordSyntenyDisplay |
| <span id="getter-channelnames">**channelNames**</span><br><code>string[]</code> | the colour channels the view's modes can paint: the preset measurements and the columns the adapter declares | ChordSyntenyDisplay |
| <span id="getter-ribboncolors">**ribbonColors**</span><br><code>Map&lt;string, number&gt;</code> | each alignment's packed colour under the view's `color`, by feature id. A chromosome mode paints the ideogram colour of the chromosome it joins, so a ribbon matches the arc it leaves; a label the view hides paints at zero alpha | ChordSyntenyDisplay |
| <span id="getter-ribbonfill">**ribbonFill**</span><br><code>(feature: Feature) =&gt; string</code> | the resting fill of each ribbon, opaque: the ribbons share one `ribbonOpacity`, so an opacity drag repaints no ribbon | ChordSyntenyDisplay |
| <span id="getter-ribbonopacity">**ribbonOpacity**</span><br><code>number</code> | the fill opacity every resting ribbon draws at: the view's `alpha`, times the alpha of a `color.value` every ribbon paints | ChordSyntenyDisplay |
| <span id="getter-drawnfeatures">**drawnFeatures**</span><br><code>Feature[] &#124; undefined</code> | what the ribbons draw: the visible alignments at least the view's `minAlignmentLength` long on their own side, less those the view's colour hides | ChordSyntenyDisplay |
| <span id="getter-shapealpha">**shapeAlpha**</span><br><code>number</code> | `ribbonOpacity`, as the canvas reads it | ChordSyntenyDisplay |
| <span id="getter-ribbonfeet">**ribbonFeet**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ x1: Float32Array&lt;ArrayBuffer&gt;; x2: Float32Array&lt;ArrayBuffer&gt;;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ x1: Float32Array&lt;ArrayBuffer&gt;; x2: Float32Array&lt;ArrayBuffer&gt;; y1: Float32Array&lt;ArrayBuffer&gt;; ... 5 more ...; index: Map&lt;...&gt;; }</code></pre></dialog></span> | every held alignment's feet on the circle's unrolled axis, by the feature's place in `features`: rebuilt by a fetch or a change to the regions, never by a recolour, a zoom or a rotation | ChordSyntenyDisplay |
| <span id="getter-ribbonlanes">**ribbonLanes**</span><br><code>RibbonLanes</code> | the drawn alignments as the ribbon mark's lanes, each in its fill with the alpha the SV inspector's dimming leaves it | ChordSyntenyDisplay |
| <span id="getter-drawncount">**drawnCount**</span><br><code>number</code> |  | ChordSyntenyDisplay |
| <span id="getter-laneindexbyid">**laneIndexById**</span><br><code>Map&lt;string, number&gt;</code> | each drawn feature's place in the lanes, by id | ChordSyntenyDisplay |
| <span id="getter-shapes">**shapes**</span><br><code>RibbonShape[]</code> | every drawn alignment as the export draws it | ChordSyntenyDisplay |
| <span id="getter-legendcolor">**legendColor**</span><br><code>string &#124; undefined</code> | the ribbon fill the circle's key shows: the one colour every ribbon paints when the view's mode keys nothing of its own | ChordSyntenyDisplay |
| <span id="getter-featurewidgettype">**featureWidgetType**</span><br><code>{ type: string; id: string; }</code> | the panel the linear synteny displays open for the same record, so a ribbon clicked on the circle and a ribbon clicked in a synteny view share one drawer entry | ChordSyntenyDisplay |
| <span id="getter-chordcell">**chordCell**</span><br><code>ChordCell &#124; undefined</code> | what the view's canvas draws for this display: its lanes while it is ready, nothing while its loading or error ring covers the circle | ChordSyntenyDisplay |
| <span id="getter-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;_OverrideProps&lt;_OverrideProps&lt;Omit&lt;Omit&lt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;_OverrideProps&lt;_OverrideProps&lt;Omit&lt;Omit&lt;…&gt;, never&gt;, _OverrideProps&lt;...&gt;&gt;, { ...; }&gt;&gt; &amp; ... 25 more ... &amp; IStateTreeNode&lt;...&gt;</code></pre></dialog></span> |  | [BaseChordDisplay](../basechorddisplay#getter-view) |
| <span id="getter-trackassemblynames">**trackAssemblyNames**</span><br><code>string[]</code> | <span data-pagefind-ignore>the track's assemblies that are on the circle, canonical and in the order the circle lays them out</span> | [BaseChordDisplay](../basechorddisplay#getter-trackassemblynames) |
| <span id="getter-fetchinert">**fetchInert**</span><br><code>boolean</code> | <span data-pagefind-ignore>nothing of this track's is on the circle, so the fetch never runs; the SVG export's wait and the retry contract check both read it</span> | [BaseChordDisplay](../basechorddisplay#getter-fetchinert) |
| <span id="getter-loaded">**loaded**</span><br><code>boolean</code> |  | [BaseChordDisplay](../basechorddisplay#getter-loaded) |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | <span data-pagefind-ignore>the off-screen export gate, on the shared `computeSvgReady` policy. A radial display has no box to draw an error in, so the export fails rather than exporting a message</span> | [BaseChordDisplay](../basechorddisplay#getter-svgready) |
| <span id="getter-displayphase">**displayPhase**</span><br><code>DisplayStatusPhase</code> |  | [BaseChordDisplay](../basechorddisplay#getter-displayphase) |
| <span id="getter-radiuspx">**radiusPx**</span><br><code>number</code> |  | [BaseChordDisplay](../basechorddisplay#getter-radiuspx) |
| <span id="getter-bezierradiusratio">**bezierRadiusRatio**</span><br><code>number</code> | <span data-pagefind-ignore>how far from the center a chord across the circle passes, as a fraction of the radius; a shorter chord bows less, in proportion to its span</span> | [BaseChordDisplay](../basechorddisplay#getter-bezierradiusratio) |
| <span id="getter-bezierradius">**bezierRadius**</span><br><code>number</code> |  | [BaseChordDisplay](../basechorddisplay#getter-bezierradius) |
| <span id="getter-sliceindex">**sliceIndex**</span><br><code>Record&lt;string, Slice&gt;</code> | <span data-pagefind-ignore>every slice of the circle, keyed by canonical assembly AND refName: two genomes on one circle can each carry a `chr1`. An elided slice answers to each refName it swallowed.</span> | [BaseChordDisplay](../basechorddisplay#getter-sliceindex) |
| <span id="getter-visiblefeatures">**visibleFeatures**</span><br><code>Feature[] &#124; undefined</code> | <span data-pagefind-ignore>`features`, narrowed to `visibleFeatureIds`</span> | [BaseChordDisplay](../basechorddisplay#getter-visiblefeatures) |
| <span id="getter-highlightedfeatureidset">**highlightedFeatureIdSet**</span><br><code>Set&lt;string&gt; &#124; undefined</code> |  | [BaseChordDisplay](../basechorddisplay#getter-highlightedfeatureidset) |
| <span id="getter-selectedfeatureid">**selectedFeatureId**</span><br><code>string &#124; undefined</code> |  | [BaseChordDisplay](../basechorddisplay#getter-selectedfeatureid) |
| <span id="getter-hoveredfeatureid">**hoveredFeatureId**</span><br><code>string &#124; undefined</code> | <span data-pagefind-ignore>the feature under the pointer, which the view resolves off its pick canvas for every chord display at once</span> | [BaseChordDisplay](../basechorddisplay#getter-hoveredfeatureid) |
| <span id="getter-chordstage">**chordStage**</span><br><code>ChordStage</code> | <span data-pagefind-ignore>the polar stage as the canvas and the pointer see it, rotation in</span> | [BaseChordDisplay](../basechorddisplay#getter-chordstage) |
| <span id="getter-figurestage">**figureStage**</span><br><code>ChordStage</code> | <span data-pagefind-ignore>the polar stage on the unrotated figure, which the view's SVG turns: what the export and the highlight paths are placed on</span> | [BaseChordDisplay](../basechorddisplay#getter-figurestage) |
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
| <span id="method-firstgenomeends">**firstGenomeEnds**</span><br><code>(feature: Feature) =&gt; readonly [string, string]</code> | an alignment's two refNames with the circle's first genome's end first, the order the view's `query` and `target` modes read them in | ChordSyntenyDisplay |
| <span id="method-shapeat">**shapeAt**</span><br><code>(i: number) =&gt; RibbonShape</code> | lane `i` as the SVG side draws it, on the unrotated figure | ChordSyntenyDisplay |
| <span id="method-shapefor">**shapeFor**</span><br><code>(featureId: string) =&gt; RibbonShape &#124; undefined</code> |  | ChordSyntenyDisplay |
| <span id="method-shapelabel">**shapeLabel**</span><br><code>(feature: Feature) =&gt; string</code> |  | ChordSyntenyDisplay |
| <span id="method-shapepathfor">**shapePathFor**</span><br><code>(feature: Feature) =&gt; string &#124; undefined</code> | a drawn feature's outline as an SVG path on the unrotated figure, for anything that has to find a ribbon on screen without a DOM node to find | ChordSyntenyDisplay |
| <span id="method-alignmentsbetween">**alignmentsBetween**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(referenceAssembly: string, currentAssembly: string) =&gt; Alignme…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(referenceAssembly: string, currentAssembly: string) =&gt; AlignmentData[]</code></pre></dialog></span> | the held alignments joining two assemblies on the circle, in canonical refNames and oriented reference side first, which is what the view's reorder reads instead of fetching the file again | ChordSyntenyDisplay |
| <span id="method-hitat">**hitAt**</span><br><code>(dx: number, dy: number) =&gt; Feature &#124; undefined</code> | the alignment whose ribbon covers a point CSS px from the circle's centre in the screen frame, the topmost where several do | ChordSyntenyDisplay |
| <span id="method-rendersvg">**renderSvg**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(_opts: ViewExportSvgOptions &amp; { theme?: ThemeOptions &#124; undefin…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(_opts: ViewExportSvgOptions &amp; { theme?: ThemeOptions &#124; undefined; }) =&gt; Promise&lt;Element &#124; null&gt;</code></pre></dialog></span> |  | ChordSyntenyDisplay |
| <span id="method-assemblyof">**assemblyOf**</span><br><code>(assemblyName: string &#124; undefined) =&gt; string &#124; undefined</code> | <span data-pagefind-ignore>the assembly on the circle a feature names, in whatever spelling the adapter wrote. A feature that names none, as a VCF record does not, is on the track's first assembly.</span> | [BaseChordDisplay](../basechorddisplay#method-assemblyof) |
| <span id="method-canonicalrefname">**canonicalRefName**</span><br><code>(assemblyName: string, refName: string) =&gt; string</code> | <span data-pagefind-ignore>a refName as the adapter wrote it, in the assembly's canonical spelling</span> | [BaseChordDisplay](../basechorddisplay#method-canonicalrefname) |
| <span id="method-slicefor">**sliceFor**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(assemblyName: string &#124; undefined, refName: string) =&gt; Slice &#124;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(assemblyName: string &#124; undefined, refName: string) =&gt; Slice &#124; undefined</code></pre></dialog></span> | <span data-pagefind-ignore>the slice one end of a feature lands on</span> | [BaseChordDisplay](../basechorddisplay#method-slicefor) |
| <span id="method-axisslice">**axisSlice**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(assemblyName: string &#124; undefined, refName: string) =&gt; AxisSlic…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(assemblyName: string &#124; undefined, refName: string) =&gt; AxisSlice &#124; undefined</code></pre></dialog></span> | <span data-pagefind-ignore>the slice of the unrolled axis one end of a feature lands on</span> | [BaseChordDisplay](../basechorddisplay#method-axisslice) |
| <span id="method-renderingprops">**renderingProps**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;{ id: IOptionalITy…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;{ id: IOptionalIType&lt;…&gt;; type: ISimpleType&lt;string&gt;; }&gt; &amp; { ...; } &amp; { ...; } &amp; { ...; } &amp; IStateTreeNode&lt;...&gt;; }</code></pre></dialog></span> | <span data-pagefind-ignore>props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks</span> | [BaseDisplay](../basedisplay#method-renderingprops) |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  | [BaseDisplay](../basedisplay#method-trackmenuitems) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-clickfeature">**clickFeature**</span><br><code>(feature: Feature) =&gt; void</code> | what a click on the canvas reaches: the alignment's details | ChordSyntenyDisplay |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | refetch, and run a reorder this launch still owes, which is how the error ring's Retry reaches a reorder that failed | ChordSyntenyDisplay |
| <span id="action-openerrordialog">**openErrorDialog**</span><br><code>() =&gt; void</code> |  | [BaseChordDisplay](../basechorddisplay#action-openerrordialog) |
| <span id="action-setfeatures">**setFeatures**</span><br><code>(features: Feature[] &#124; undefined) =&gt; void</code> |  | [BaseChordDisplay](../basechorddisplay#action-setfeatures) |
| <span id="action-sethighlightedfeatureids">**setHighlightedFeatureIds**</span><br><code>(ids: string[] &#124; undefined) =&gt; void</code> |  | [BaseChordDisplay](../basechorddisplay#action-sethighlightedfeatureids) |
| <span id="action-setvisiblefeatureids">**setVisibleFeatureIds**</span><br><code>(ids: string[] &#124; undefined) =&gt; void</code> |  | [BaseChordDisplay](../basechorddisplay#action-setvisiblefeatureids) |
| <span id="action-setstatusmessage">**setStatusMessage**</span><br><code>(status?: RpcStatus &#124; undefined) =&gt; void</code> |  | [BaseDisplay](../basedisplay#action-setstatusmessage) |
| <span id="action-seterror">**setError**</span><br><code>(error?: unknown) =&gt; void</code> |  | [BaseDisplay](../basedisplay#action-seterror) |
| <span id="action-clearhoveredfeature">**clearHoveredFeature**</span><br><code>() =&gt; void</code> | <span data-pagefind-ignore>Overridable hook (default no-op): drop whatever `hoveredFeature` reports. The writing twin of that getter, and what `installClearHoverOnViewportChange` calls.<br><br>A display that STORES its hover owes an override; one that derives it from the live pointer (MAF, Hi-C, LD) owes nothing, and the default costs it nothing. Declared here so the clear can be installed for every display rather than remembered per display — forgetting it is the failure ARCHITECTURE.md's stored-hover section is about, and it used to be six closures at six call sites, which is six chances to omit one.</span> | [BaseDisplay](../basedisplay#action-clearhoveredfeature) |
| <span id="action-applydisplaysettings">**applyDisplaySettings**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(settings: Record&lt;string, unknown&gt;, options?: { allowSetters?:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(settings: Record&lt;string, unknown&gt;, options?: { allowSetters?: boolean &#124; undefined; } &#124; undefined) =&gt; { applied: string[]; unapplied: UnappliedSetting[]; failed: { ...; }[]; }</code></pre></dialog></span> | <span data-pagefind-ignore>Apply a set of display settings to the live display, and report which were applied. Each key runs through the display config schema's `preProcessSnapshot` (shorthand expansions and legacy-key migrations, as `showTrackGeneric` applies to a session spec's inline track keys), then writes the matching config slot. A key naming a sub-schema (`facet`, `color`) replaces the whole object, its string shorthand lifted by that schema, and `null` clears it. Keys that are not slots come back in `unapplied` as `{ key, reason }`, so a caller can tell a misspelling from a key that has an action instead of a slot.<br><br>`allowSetters` also routes a non-slot key to a single-argument action named `set<Key>`. It is off by default because session specs, share links and embeds pass untyped JSON here, and a default fallback would let them call internal setters (`setError`, `setScrollTop`, ...) and call multi-argument setters with one argument. A caller that wants a specific action can call it directly.<br><br>A key whose write threw is reported in `failed`. Only `failed` means the caller passed a bad value. `unapplied` needs the caller's own context to read: `showTrackGeneric` spreads the same settings into the display's snapshot, so a declared prop (`resolution`) has already landed by the time it reports here, while the restyle path spreads nothing and every entry there did nothing.<br><br>A per-key error does not abort the remaining keys. A caller mid-`showTrack` has already pushed the track, and one rejected value should not leave it half-configured.</span> | [BaseDisplay](../basedisplay#action-applydisplaysettings) |
