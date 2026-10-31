---
id: linearvariantdisplay
title: LinearVariantDisplay
description: "The variant display: a VCF's records stacked as a feature track stacks them, over one genotype row per sample, with the feature widget on a click on a record or a cell."
sidebar_label: Display -> LinearVariantDisplay
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearVariantDisplay/model.ts).

The variant display: a VCF's records stacked as a feature track stacks
them, over one genotype row per sample, with the feature widget on a click
on a record or a cell. With no sample rows the records are the display.

## Example usage

`unit`, `rowColor`, `rows` and `filter` are
config (see the display's config schema), read at runtime through `getConf`
and written as session edits to the track's config — they are not plain MST
properties. Set them in a track's `displays` array to change the default:

```js
displays: [
  {
    type: 'LinearVariantDisplay',
    displayId: 'my-cohort',
    unit: 'haplotype',
    rowColor: 'population',
    rows: { sort: ['NA12878', 'NA12891'] },
    filter: [{ field: 'minorAlleleFrequency', gte: 0.05 }],
  },
]
```

`runClustering` is a transient declarative launch spec, the same idea as
`LinearGenomeView`'s `init`: set it to run the real "Cluster rows by genotype"
RPC once automatically (no dialog) as soon as sources are available, and it
clears itself afterwards so a saved session never re-triggers it.

```js
displays: [
  {
    type: 'LinearVariantDisplay',
    runClustering: true,
  },
]
```

## How the rows are arranged

The arrangement is config: `rows` holds the order, the labels, the cluster
tree with its provenance and the focus, and `rowColor` the colors, each by
row name at the mode's granularity — a sample in allele-count mode, a
haplotype (`"<sample> HP<n>"`) in phased mode, where a sample name stands
for its haplotypes. A drag, the arrangement dialog, "Sort rows by genotype here" and
a clustering run write it; the rows are derived from it on every read:

1. `rows.kept` focuses the adapter's samples (`adapterSamples`) to the set
   the fetch asks for (`sourcesBase`, `sampleFilter`),
2. phased mode expands each sample to its haplotypes (`expandedRows`), and
   `rows.sort` orders them, `rows.labels` relabels them and each row has
   its resolved `rowColor` (`editableSources`, the dialog's list), each from
   `TreeSidebarMixin` over this display's hooks,
3. the focus narrows those (`clusterableSources`, what a run clusters),
4. `facet` stacks those in bands (`bandedSources`), each band's rows in their
   arranged order,
5. the result is `sources`, each row's `rowColor` its label bar.

**The `rowColor` palette wins over a color the row already has**, a
`samplesTsv` `color` column: a channel bound to a variable beats a per-row
constant, so "Color by… → (none)" restores the row's color from that column.
`rowColor` holds one field's values, so a dialog color set under the palette
turns every row's color into a `name` pair.

**The `facet` bands win over a tree**: a band draws the clade of the tree
whose leaves are exactly its rows in order, and a clustering run under bands
clusters each band apart and writes one forest. A whole-cohort tree under a
facet set afterwards draws where a band happens to be a clade, and the hint
counts the bands without one.

The configuration slots for this model are documented on its [config schema page](../../config/linearvariantdisplay).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal(VARIANT_DISPLAY)</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |
| <span id="property-featurehighlights">**featureHighlights**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>featureHighlights: types.stripDefault( types.array(FeatureHighl…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>featureHighlights: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.array(FeatureHighlightModel),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;[],&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | The records a search hit, a right-click or the `highlight=` param boxes on the records band, as on a feature track. |

<details class="inherited-members" data-pagefind-ignore>
<summary>5 inherited properties from 3 models</summary>

From [TreeSidebarMixin](../treesidebarmixin): <span id="property-runclustering">[`runClustering`](../treesidebarmixin#property-runclustering)</span>, <span id="property-clusterregion">[`clusterRegion`](../treesidebarmixin#property-clusterregion)</span>, <span id="property-sortrowsby">[`sortRowsBy`](../treesidebarmixin#property-sortrowsby)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="property-parkedcolors">[`parkedColors`](../parkedcolormixin#property-parkedcolors)</span>

From [BaseDisplay](../basedisplay): <span id="property-id">[`id`](../basedisplay#property-id)</span>

</details>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-samplelisting">**sampleListing**</span><br><code>AdapterRead&lt;Source[]&gt; &#124; undefined</code> | The adapter's sample list, stamped with the adapter config it answers. |
| <span id="volatile-celldata">**cellData**</span><br><code>CellDataResult &#124; undefined</code> | The fetched per-display data, replaced whole by each fetch. |
| <span id="volatile-celldataregionindices">**cellDataRegionIndices**</span><br><code>ReadonlySet&lt;number&gt;</code> | The displayed regions the current `cellData` was fetched for. The payload does not list them: a region with no variants gets no `perRegionCellData` entry, and the columns payload is one entry for every region. |
| <span id="volatile-celldatabpperpx">**cellDataBpPerPx**</span><br><code>number &#124; undefined</code> | The zoom the current `cellData` was fetched at, set in columns alone. The columns are the features of exactly the span on screen, so after a zoom inside the loaded span the held payload still lays out features the view no longer shows. Undefined answers at every zoom, as the position-drawn payload does. |
| <span id="volatile-hoveredcell">**hoveredCell**</span><br><code>HoveredCell &#124; undefined</code> | The genotype cell under the pointer, as `hoverInk` lights it; the shared tooltip slot holds no cell instance. |
| <span id="volatile-hoveredrecord">**hoveredRecord**</span><br><code>HitFeatureResult &#124; undefined</code> | The record under the pointer in the records band, plugin-features's hit result, so `hoverInk` lights the box the band painted. |
| <span id="volatile-hoveredmatrixcell">**hoveredMatrixCell**</span><br><code>MatrixHoveredCell &#124; undefined</code> | The matrix cell under the pointer, in the equal-width column layout. |
| <span id="volatile-backenddrawscolumns">**backendDrawsColumns**</span><br><code>boolean</code> | Whether the attached backend draws columns, so the upload sends it the payload it can draw across the swap a layout change makes. |
| <span id="volatile-recordsopeningheightsettled">**recordsOpeningHeightSettled**</span><br><code>boolean</code> | Whether the first layout has decided the records-only height (`settleRecordsOpeningHeight`), which then holds. |

<details class="inherited-members" data-pagefind-ignore>
<summary>29 inherited volatiles from 10 models</summary>

From [ContextMenuMixin](../contextmenumixin): <span id="volatile-contextmenuinfo">[`contextMenuInfo`](../contextmenumixin#volatile-contextmenuinfo)</span>

From [TreeSidebarMixin](../treesidebarmixin): <span id="volatile-hoveredtreenode">[`hoveredTreeNode`](../treesidebarmixin#volatile-hoveredtreenode)</span>, <span id="volatile-treecanvas">[`treeCanvas`](../treesidebarmixin#volatile-treecanvas)</span>, <span id="volatile-mouseovercanvas">[`mouseoverCanvas`](../treesidebarmixin#volatile-mouseovercanvas)</span>

From [StoredHoverMixin](../storedhovermixin): <span id="volatile-storedhoveredfeature">[`storedHoveredFeature`](../storedhovermixin#volatile-storedhoveredfeature)</span>

From [LegendMixin](../legendmixin): <span id="volatile-dismissedlegendsections">[`dismissedLegendSections`](../legendmixin#volatile-dismissedlegendsections)</span>

From [FeatureGateMixin](../featuregatemixin): <span id="volatile-densitystatsperregion">[`densityStatsPerRegion`](../featuregatemixin#volatile-densitystatsperregion)</span>

From [MultiRegionDisplayMixin](../multiregiondisplaymixin): <span id="volatile-loadedregions">[`loadedRegions`](../multiregiondisplaymixin#volatile-loadedregions)</span>

From [FetchMixin](../fetchmixin): <span id="volatile-activesignal">[`activeSignal`](../fetchmixin#volatile-activesignal)</span>, <span id="volatile-fetchgeneration">[`fetchGeneration`](../fetchmixin#volatile-fetchgeneration)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../fetchmixin#volatile-reloadcounter)</span>, <span id="volatile-statuswindow">[`statusWindow`](../fetchmixin#volatile-statuswindow)</span>, <span id="volatile-error">[`error`](../fetchmixin#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../fetchmixin#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../fetchmixin#volatile-statusprogress)</span>, <span id="volatile-fetchcanceled">[`fetchCanceled`](../fetchmixin#volatile-fetchcanceled)</span>, <span id="volatile-fetchrotation">[`fetchRotation`](../fetchmixin#volatile-fetchrotation)</span>

From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="volatile-canvasdrawn">[`canvasDrawn`](../renderlifecyclemixin#volatile-canvasdrawn)</span>, <span id="volatile-paintcount">[`paintCount`](../renderlifecyclemixin#volatile-paintcount)</span>, <span id="volatile-currentrenderingbackend">[`currentRenderingBackend`](../renderlifecyclemixin#volatile-currentrenderingbackend)</span>, <span id="volatile-rendertick">[`renderTick`](../renderlifecyclemixin#volatile-rendertick)</span>, <span id="volatile-autorunsinstalled">[`autorunsInstalled`](../renderlifecyclemixin#volatile-autorunsinstalled)</span>, <span id="volatile-rendererror">[`renderError`](../renderlifecyclemixin#volatile-rendererror)</span>, <span id="volatile-offscreen">[`offScreen`](../renderlifecyclemixin#volatile-offscreen)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="volatile-forceloadtrack">[`forceLoadTrack`](../regiontoolargemixin#volatile-forceloadtrack)</span>, <span id="volatile-byteestimate">[`byteEstimate`](../regiontoolargemixin#volatile-byteestimate)</span>, <span id="volatile-gatemeasuredviewportkey">[`gateMeasuredViewportKey`](../regiontoolargemixin#volatile-gatemeasuredviewportkey)</span>

From [TrackHeightMixin](../trackheightmixin): <span id="volatile-scrolltop">[`scrollTop`](../trackheightmixin#volatile-scrolltop)</span>, <span id="volatile-hostheight">[`hostHeight`](../trackheightmixin#volatile-hostheight)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-adaptersamples">**adapterSamples**</span><br><code>Source[] &#124; undefined</code> | The samples the adapter lists, undefined until the current adapter config's list lands. |
| <span id="getter-view">**view**</span><br><code><a href="../lineargenomeview">LinearGenomeView</a></code> |  |
| <span id="getter-hasphasedorhaploid">**hasPhasedOrHaploid**</span><br><code>boolean</code> | Whether any called genotype is phased or haploid (no `/`), which gates the per-haplotype rows; a pangenome callset writes bare `0`/`1` with no `\|` anywhere. |
| <span id="getter-hassecondaryalt">**hasSecondaryAlt**</span><br><code>boolean</code> | Whether the worker painted a secondary-alt cell, which keys the "Other alt allele" legend entry. Painted, not possible. |
| <span id="getter-hasaltwithoutphaseset">**hasAltWithoutPhaseSet**</span><br><code>boolean</code> | Whether phase-set coloring painted an alt cell whose call names no phase set, which keys that cell's plain hue. |
| <span id="getter-hasunphased">**hasUnphased**</span><br><code>boolean</code> | Whether the worker painted a black unphased cell (drives the "Unphased" legend entry). |
| <span id="getter-hasnocall">**hasNoCall**</span><br><code>boolean</code> | Whether the worker painted a no-call cell (drives the "No call" legend entry). |
| <span id="getter-hasconsequence">**hasConsequence**</span><br><code>boolean</code> | Whether any visible variant has a SnpEff/VEP annotation, gating the "Color by→Consequence impact" menu option. |
| <span id="getter-hassvtype">**hasSvType**</span><br><code>boolean</code> | Whether any visible variant is a structural variant, gating the "Color by...→SV type" menu option. |
| <span id="getter-hasphaseset">**hasPhaseSet**</span><br><code>boolean</code> | Whether any visible variant declares a phase set (PS in FORMAT), gating the "Color by→Phase set" menu option. |
| <span id="getter-sampleploidy">**samplePloidy**</span><br><code>Readonly&lt;Record&lt;string, number&gt;&gt; &#124; undefined</code> | Each sample's ploidy as the latest fetch reports it, the same object while a region arrival reports the same ploidies, so the phased rows are expanded again only when one changes. |
| <span id="getter-unit">**unit**</span><br><code>"haplotype" &#124; "sample"</code> |  |
| <span id="getter-variantlayout">**variantLayout**</span><br><code>"columns" &#124; "genomic"</code> | Whether each variant draws at its genomic span, or as one of a row of equal-width columns tied to its position by a connector line: the `variantLayout` slot while genotype rows draw. Columns lay out rows, so with none (no samples, or `genotypes.show` off) the records band draws at genomic positions, and the slot's columns come back with the rows. |
| <span id="getter-atgenomicpositions">**atGenomicPositions**</span><br><code>boolean</code> |  |
| <span id="getter-linezoneheight">**lineZoneHeight**</span><br><code>number</code> | Height of the connector-line zone above the columns; 0 at genomic positions, where nothing needs connecting. |
| <span id="getter-showgenotypes">**showGenotypes**</span><br><code>boolean</code> | `genotypes.show`: whether the display reads genotypes and draws a row per sample. |
| <span id="getter-showrowseparators">**showRowSeparators**</span><br><code>boolean</code> |  |
| <span id="getter-showtooltips">**showTooltips**</span><br><code>boolean</code> | Whether a hover draws the tooltip table. The crosshairs, the hovered-cell highlight and `hoveredFeature` keep working with it off. |
| <span id="getter-facet">**facet**</span><br><code>FacetSetting &#124; undefined</code> | The `facet` object as written: the sample-metadata attribute whose values band the rows, and the band order; undefined leaves the existing order alone. |
| <span id="getter-colorsetting">**colorSetting**</span><br><code>ColorSetting</code> | `encoding.color` as written, `value` raw: a `jexl:` callback is the worker's to evaluate per variant. |
| <span id="getter-livenotices">**liveNotices**</span><br><code>string[]</code> | `rowBandingNotices`, and each `filter` field no loaded variant carries. |
| <span id="getter-colorencoding">**colorEncoding**</span><br><code>string &#124; FieldColorEncoding &#124; undefined</code> | What the alt cells' hue paints: undefined for the genotype colors, a CSS color or `jexl:` callback, or a field through its ordinal or threshold scale (`shared/cellHue.ts`). |
| <span id="getter-colorfield">**colorField**</span><br><code>string</code> | The field the alt cells paint by, '' while they paint the genotype colors or a constant. |
| <span id="getter-featurewidgettype">**featureWidgetType**</span><br><code>{ type: string; id: string; }</code> |  |
| <span id="getter-featurenoun">**featureNoun**</span><br><code>string</code> | The noun the feature menu rows name a record by: "Zoom to variant". |
| <span id="getter-canonicaltranscripts">**canonicalTranscripts**</span><br><code>CanonicalTranscripts</code> | The sequence dialog's isoform tags; a record has no isoforms, so the defaults. |
| <span id="getter-recordsonly">**recordsOnly**</span><br><code>boolean</code> | Whether the VCF's sample listing landed empty: the records band is then the display, every record the filter admits, sized by `heightMode` and lettered as a feature track. |
| <span id="getter-drawsrows">**drawsRows**</span><br><code>boolean</code> | Whether genotype rows draw: `genotypes.show`, on a VCF with samples. Hidden, the rows take no height and the records band is the track. |
| <span id="getter-showrecords">**showRecords**</span><br><code>boolean</code> | Whether the records band is drawn: at genomic positions only, where a record lines up with the cells under it, and always while no row draws. |
| <span id="getter-recordsheightwritten">**recordsHeightWritten**</span><br><code>boolean</code> | Whether a drag, a config or the opening settle wrote `records.height`; until then the band over rows is its stack, up to the default. |
| <span id="getter-recordsheight">**recordsHeight**</span><br><code>number</code> | `records.height`, or the default the band opens at up to its stack while none is written. Raw: what the band spends is `topBands.recordsHeight`. |
| <span id="getter-recordslabels">**recordsLabels**</span><br><code>RecordsLabels</code> | The field each label kind of the records band reads, empty where it is hidden; what it draws is `recordsRenderedLabels`. |
| <span id="getter-recordsfacet">**recordsFacet**</span><br><code>FacetSetting &#124; undefined</code> | `records.facet` as written, or undefined while the records stack in one section. The display's own `facet` bands the sample rows. |
| <span id="getter-recordshiddengroups">**recordsHiddenGroups**</span><br><code>ReadonlySet&lt;string&gt;</code> | The record sections the user hid, `records.facet.hidden`. |
| <span id="getter-recordsfeatureheight">**recordsFeatureHeight**</span><br><code>number</code> | `records.mark.height`, each record's body at `normal`. |
| <span id="getter-recordstooltipfield">**recordsTooltipField**</span><br><code>string</code> | `records.tooltip.field`, the record's line in the hover tooltip. |
| <span id="getter-recordfieldreads">**recordFieldReads**</span><br><code>RecordFieldReads</code> | What the worker reads off each record for the band beyond the payload: a tooltip or label field other than its default, which the band reads off the payload's own name and description, and the records' facet field. A label is read shown or hidden, so its checkbox redraws rather than refetches. |
| <span id="getter-recordscolorbysvclass">**recordsColorBySvClass**</span><br><code>boolean</code> | Whether the records band colors by SV class, the rest `featureDefaultColor`: while no `encoding.color` is picked, with rows or without, and under `phaseSet`, a genotype's value that no record holds. Any other picked color paints the records as it paints the cells. |
| <span id="getter-cellcolorkeyed">**cellColorKeyed**</span><br><code>boolean</code> | Whether the cells' coloring is keyed: always while rows draw; with none only under a picked `encoding.color` field, whose values the records paint. A constant paints every record alike, so keys nothing. |
| <span id="getter-recordsdisplaymode">**recordsDisplayMode**</span><br><code>"collapsed" &#124; "compact" &#124; "normal" &#124; "superCompact"</code> | `records.displayMode`, and unset the one rule its default follows: `compact` over rows, tight with its one label line; with no rows `normal`, a feature track's default. |
| <span id="getter-recordsfontsize">**recordsFontSize**</span><br><code>number</code> | The size the band letters at, plugin-features's for its display mode, so the width its packer reserved is the width the text draws. |
| <span id="getter-growmaxheight">**growMaxHeight**</span><br><code>number</code> | `HeightModeMixin`'s ceiling on `grow`: the slot's with no rows; over rows none, so `height` holds in every mode. |
| <span id="getter-densitygateactive">**densityGateActive**</span><br><code>boolean</code> | The density axis acts only with no genotype rows, where the records are the display, as on `LinearVariantDisplay`. Over rows the byte gate alone guards the fetch. |
| <span id="getter-configuredmaxfeaturescreendensity">**configuredMaxFeatureScreenDensity**</span><br><code>number</code> | `records.maxFeatureScreenDensity`, the density budget. |
| <span id="getter-sitefilter">**siteFilter**</span><br><code>FieldPredicate[]</code> | The `filter` list's site fields, `minorAlleleFrequency` and `missingness`, which the worker tests off each site's allele summary. |
| <span id="getter-minminorallelefrequency">**minMinorAlleleFrequency**</span><br><code>number</code> | The floor the filter puts on `minorAlleleFrequency`, 0 for none: the slider's value |
| <span id="getter-maxmissingness">**maxMissingness**</span><br><code>number</code> | The ceiling the filter puts on `missingness`, 1 for none: the slider's value |
| <span id="getter-filters">**filters**</span><br><code>SerializableFilterChain &#124; undefined</code> | The `filter` list's other entries as the RPC's `filters` arg. |
| <span id="getter-showreference">**showReference**</span><br><code>boolean</code> | `genotypes.reference.show`: each reference call draws as a cell, rather than the rows' grey fill standing in for it. |
| <span id="getter-colorbyattributes">**colorByAttributes**</span><br><code>string[]</code> | Distinct sample-metadata attributes (from samplesTsv) the user can color rows by — every key the sources have except internal plumbing. |
| <span id="getter-rowcolorpaintsmarks">**rowColorPaintsMarks**</span><br><code>boolean</code> | `TreeSidebarMixin`'s hook: never, since the cells paint by genotype and a row's color shows only on its label bar. |
| <span id="getter-internalrowfields">**internalRowFields**</span><br><code>readonly string[]</code> | `TreeSidebarMixin`'s hook: a haplotype row's `sampleName` and `HP`, which the arrangement dialog lists as no column. |
| <span id="getter-rowcolorfields">**rowColorFields**</span><br><code>readonly string[]</code> | `TreeSidebarMixin`'s hook: the samplesTsv attributes, the ones "Color by" offers. |
| <span id="getter-discoveredrows">**discoveredRows**</span><br><code>ProcessedSource[]</code> | `TreeSidebarMixin`'s hook: the adapter's samples as rows, each answering to its sample name, a samplesTsv `color` column the row's own color. None while `genotypes.show` is off. |
| <span id="getter-rowalias">**rowAlias**</span><br><code>RowAlias</code> | `TreeSidebarMixin`'s hook: a haplotype row answers to its sample's name, so an order, a label, a tint or a focus written against a sample reaches each of its haplotypes. |
| <span id="getter-rowbanding">**rowBanding**</span><br><code>RowBanding &#124; undefined</code> | `TreeSidebarMixin`'s hook: the `facet` bands the rows by a samplesTsv attribute. |
| <span id="getter-sourcesbase">**sourcesBase**</span><br><code>Source[] &#124; undefined</code> | The adapter's samples narrowed to the focus, `rows.kept`: the row set the fetch asks for, so it must not read `samplePloidy`. `undefined` until the samples land; that transition wakes the fetch autorun (reference/FETCH_KEYS.md). |
| <span id="getter-clusteringready">**clusteringReady**</span><br><code>boolean</code> | Whether the rows are at the granularity they draw, which clustering and the arrangement dialog need: phased mode draws haplotypes, which needs the `samplePloidy` a fetch brings. |
| <span id="getter-hasclusterablerows">**hasClusterableRows**</span><br><code>boolean</code> | Whether there are at least two rows on screen to put in an order, counted over `clusterableSources`, the list a run clusters. |
| <span id="getter-autoclusterready">**autoClusterReady**</span><br><code>boolean</code> | Whether the declarative `runClustering: true` path may fire: the fetched inputs have landed and two or more rows are on screen. |
| <span id="getter-samplefilter">**sampleFilter**</span><br><code>string[] &#124; undefined</code> | Which samples the worker emits rows for, as a sorted set: row order is not a fetch input (reference/FETCH_KEYS.md). `undefined` means the sources haven't loaded and is never reused for "all of them", or the fetch would not wake when they land. Reads `sourcesBase`, never `sources`, which reads the fetch-derived `samplePloidy`. |
| <span id="getter-cellhueinput">**cellHueInput**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ encoding: ColorEncoding &#124; undefined; keptField: string &#124; unde…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ encoding: ColorEncoding &#124; undefined; keptField: string &#124; undefined; }</code></pre></dialog></span> | The painted `encoding.color` and the field kept beside it, which `cellHue` resolves. |
| <span id="getter-cellhueread">**cellHueRead**</span><br><code>CellHueRead</code> | What the worker reads off each variant for the alt cells' hue, apart from the loaded values a ramp follows. |
| <span id="getter-cellhuevaluesread">**cellHueValuesRead**</span><br><code>boolean</code> | Whether the held payload's color values were read for the current `encoding.color`; one read for another paints as though it read none. |
| <span id="getter-cellhue">**cellHue**</span><br><code>CellHue</code> | Where the alt cells' hue comes from: what the worker reads and how the main thread paints it (`cellHueOf`), a ramp over the values every fetched region read. |
| <span id="getter-painteddomain">**paintedDomain**</span><br><code>string[]</code> | The cell scale's domain values an alt cell was painted for in the fetched cell data — the impact tiers or SV classes the legend lists. |
| <span id="getter-recordcarriersamples">**recordCarrierSamples**</span><br><code>readonly string[]</code> | The samples a record's carrier share is out of: the ones shown as rows, so it matches the matrix under it. A haplotype row counts as its sample. |
| <span id="getter-recordcarriers">**recordCarriers**</span><br><code>ReadonlyMap&lt;string, RecordCarriers&gt;</code> | Each record's carriers among `recordCarrierSamples`, once per payload and row set; none with no rows to carry it. |
| <span id="getter-regionrecordcolors">**regionRecordColors**</span><br><code>Map&lt;number, Uint32Array&lt;ArrayBufferLike&gt;&gt;</code> | Each fetched region's record colors: the SV class or `featureDefaultColor` (`svClassColors`), or under a picked `encoding.color` the alt cells' hue at full dose, which neither shading nor the phased mode moves. |
| <span id="getter-recordslayoutinputs">**recordsLayoutInputs**</span><br><code>FitLadderHost['layoutInputs']</code> | What the band's packer reads, minus the label reservation each fit rung varies. `coarseBpPerPx`, so packing does not recompute per frame of a zoom. |
| <span id="getter-recordsspans">**recordsSpans**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ regionKey: string; flatbushItems: { featureId: string; startB…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ regionKey: string; flatbushItems: { featureId: string; startBp: number; endBp: number; }[]; }[]</code></pre></dialog></span> | The spans of the records the band draws, per fetched region, once per payload. |
| <span id="getter-recordsonscreenids">**recordsOnScreenIds**</span><br><code>ReadonlySet&lt;string&gt;</code> | The records the band draws whose span touches the screen, as LinearBasicDisplay's `onScreenFeatureIds`: what its labels gate on, so records buffered off screen cost no label. None before the view has a width to lay its blocks out across. |
| <span id="getter-recordsmeasureids">**recordsMeasureIds**</span><br><code>ReadonlySet&lt;string&gt; &#124; undefined</code> | The records the band's fit and height measure: with no rows those on screen, as a feature track measures; over rows every fetched one, so the rows under the band hold still between fetches. |
| <span id="getter-recordslabeldensityperpx">**recordsLabelDensityPerPx**</span><br><code>number</code> | Records on screen per pixel of the blocks on screen, as LinearBasicDisplay's `labelDensityPerPx`. |
| <span id="getter-recordspackmode">**recordsPackMode**</span><br><code>"collapsed" &#124; "compact" &#124; "normal" &#124; "superCompact"</code> | The display mode the band packs at: `records.displayMode`, except over rows past `records.maxFeatureScreenDensity` on screen, where the records collapse into one row, the density at which a feature track refuses the window, as the records-only display does. |
| <span id="getter-recordsvisiblelabels">**recordsVisibleLabels**</span><br><code>RecordsLabels</code> | `recordsLabels` past LinearBasicDisplay's label density rule (`labelVisibility`): names go past 0.2 records per pixel on screen and descriptions past 0.1, as on a feature track. |
| <span id="getter-recordsrenderdatamap">**recordsRenderDataMap**</span><br><code>ReadonlyMap&lt;number, LayoutRegionData&gt;</code> | The band's records as plugin-features render data, one entry per fetched region, empty while the band is off. Keyed off the payload and the displayed regions' bounds, never the row-placed map or `visibleRegions`, which would rebuild it per reorder or per frame. |
| <span id="getter-recordscolorscales">**recordsColorScales**</span><br><code>ColorScale[]</code> | The key to the records band's SV classes, the ones its records hold, while it colors by them. |
| <span id="getter-sourcemap">**sourceMap**</span><br><code>Map&lt;string, ProcessedSource&gt;</code> | Row name -> source, for the hover tooltip. A Map because row names come from the file, and on a plain object a sample called `constructor` resolves to something inherited rather than to a miss. |
| <span id="getter-genotypesampleindex">**genotypeSampleIndex**</span><br><code>Map&lt;string, number&gt; &#124; undefined</code> | sampleName -> column of each feature's interned `genotypeCodes`, for the tooltips (genotypeCodec.ts). Rebuilt per pointer frame, its readers being untracked pointer handlers. A keep-alive autorun was tried and throws on test stubs that resolve the cell-data RPC to a bare `[]`. |
| <span id="getter-rowremap">**rowRemap**</span><br><code>Uint32Array&lt;ArrayBufferLike&gt; &#124; undefined</code> | Worker row -> screen row. The cells arrive numbered against the worker's `rowNames`, so rebuilding this is all a reorder costs, and a change that moves no row hands back the previous array. A worker row the display isn't drawing maps to `HIDDEN_ROW`, which every painter's Y-cull puts below the canvas. Undefined until data lands: never fall back to identity: the worker's order is not the screen order. |
| <span id="getter-availableheight">**availableHeight**</span><br><code>number</code> | Height left for the rows under the bands above them, floored at 0: every consumer treats it as a pixel dimension. None while no row draws. |
| <span id="getter-nrow">**nrow**</span><br><code>number</code> |  |
| <span id="getter-autorowheight">**autoRowHeight**</span><br><code>number</code> | What fit-to-display-height divides between the rows. |
| <span id="getter-svgsidebar">**svgSidebar**</span><br><code>SvgSidebarProps</code> |  |
| <span id="getter-topbands">**topBands**</span><br><code>VariantTopBands</code> | The bands stacked above the rows, resolved once: the layout below and the painters read this instead of summing the bands (`variantTopBands.ts`). The records band is `records.height` once written, its `full` rung's stack up to the default before. |
| <span id="getter-growtargetheight">**growTargetHeight**</span><br><code>number</code> | `HeightModeMixin`'s hook: with no rows, the records' `full` stack on screen, as LinearBasicDisplay grows to its features; over rows the slot height, so `grow` keeps the rows' height. |
| <span id="getter-recordsfitstage">**recordsFitStage**</span><br><code>FitStage</code> | The rung the band keeps and the scale that fits it, off LinearBasicDisplay's ladder run against `recordsHeight`: under the cap the `full` rung fits at scale 1; past it descriptions go, then bodies thin, names decimate, names go, and the boxes squeeze. |
| <span id="getter-recordslaidoutdatamap">**recordsLaidOutDataMap**</span><br><code>ReadonlyMap&lt;number, FeatureDataResult&gt;</code> | What the band's painter, labels and hit test all read: the kept stack. With no rows it is scaled when the fit squeezed it, as a feature track's; over rows it never squeezes, and past the ladder's last rung a record that does not fit the band hides. |
| <span id="getter-recordshiddencount">**recordsHiddenCount**</span><br><code>number</code> | How many records on screen the band leaves unplaced, past its height over rows. |
| <span id="getter-recordsstackheight">**recordsStackHeight**</span><br><code>number</code> | The band's whole stack at full size, labels included: the height at which no record hides. |
| <span id="getter-recordsgroupsections">**recordsGroupSections**</span><br><code>FeatureGroupSection[]</code> | The record sections in stacking order, each with the chip row the packer reserved above it; empty while the records are one section. |
| <span id="getter-recordsrenderedlabels">**recordsRenderedLabels**</span><br><code>{ showLabels: boolean; showDescriptions: boolean; }</code> | Which label kinds the band paints: what the kept rung reserved, so a box never claims width for a description the band had no room for. |
| <span id="getter-recordsflatbushindexes">**recordsFlatbushIndexes**</span><br><code>Map&lt;number, FlatbushRegionIndexes&gt;</code> | Per-region hit index over the band's laid-out records, off the painted stack and the RENDERED label flags, a label's overhang being part of its hit box. Held alive by the `RecordsHitIndexes` autorun across pointer frames. |
| <span id="getter-rowsheaderheight">**rowsHeaderHeight**</span><br><code>number</code> | `TreeSidebarMixin`'s hook: the records band and the connector-line zone, which `rowsTopOffset` stacks the focus chip's line under. |
| <span id="getter-scrollcontentheight">**scrollContentHeight**</span><br><code>number</code> | The rows; with no rows the records' drawn stack on screen, as a feature track scrolls what `fixed` or a capped `grow` cannot show. |
| <span id="getter-scrollviewportheight">**scrollViewportHeight**</span><br><code>number</code> |  |
| <span id="getter-recordsscrolltop">**recordsScrollTop**</span><br><code>number</code> | How far the records band is scrolled: the display's `scrollTop` with no rows, where the band is what scrolls, else 0. |
| <span id="getter-layoutready">**layoutReady**</span><br><code>boolean</code> | `MultiRegionDisplayMixin`'s hook: whether `searchFeatureByID` has a laid-out band to search, so an overlay can tell a record off the band from a band not laid out yet. |
| <span id="getter-recordsitembyid">**recordsItemById**</span><br><code>Map&lt;string, FlatbushItem&gt;</code> | The band's laid-out records by id, what `searchFeatureByID` reads. |
| <span id="getter-height">**height**</span><br><code>number</code> | Over genotype rows the records band adds its height to the track above them, so the rows keep the slot's height; with the rows hidden the track is the band and its chip strip, the slot kept for the rows' return. With no samples the band is the display, sized by `heightMode`, and in a ring's band it is taken from the rows. Overrides `HeightModeMixin.height`. |
| <span id="getter-recordsregioninstanceindexes">**recordsRegionInstanceIndexes**</span><br><code>ReadonlyMap&lt;number, RegionInstanceIndex&gt;</code> | The band's record ids to the primitives they painted, per region, built when a hover or a highlight first asks. |
| <span id="getter-recordsinkhost">**recordsInkHost**</span><br><code>FeatureInkHost</code> | The band as plugin-features's ink reads a feature track: its stack, its scroll and height, and the labels it drew. |
| <span id="getter-selectedfeatureid">**selectedFeatureId**</span><br><code>string &#124; undefined</code> | The session's selected feature's id: a record a click opened, off the band or a cell. |
| <span id="getter-selectionink">**selectionInk**</span><br><code>HighlightRect[]</code> | `HighlightHost`'s selection: the selected record's box on the band. |
| <span id="getter-resolvedhighlights">**resolvedHighlights**</span><br><code>ResolvedHighlights</code> | Which band records each stored highlight boxes. A record the band does not draw (an SNV over rows) boxes nothing. |
| <span id="getter-highlightedfeatureidset">**highlightedFeatureIdSet**</span><br><code>ReadonlySet&lt;string&gt;</code> | The band records any highlight boxes, what the Highlight row reads. |
| <span id="getter-pinnedink">**pinnedInk**</span><br><code>HighlightRect[]</code> | `HighlightHost`'s pinned boxes: each highlighted record's box on the band, as the hover box lights it. |
| <span id="getter-rowunmap">**rowUnmap**</span><br><code>Int32Array&lt;ArrayBufferLike&gt; &#124; undefined</code> | Screen row -> worker row, `-1` for a screen row the data has no cells for. The cell arrays stay in the worker's numbering, which `findCellIndex` binary-searches, so the hit test converts its row. |
| <span id="getter-hoveredtooltipsource">**hoveredTooltipSource**</span><br><code>VariantHoverFields &#124; undefined</code> | The hovered thing as the tooltip table reads it: the record's fields over the hovered row's sample metadata. Undefined with `tooltip.show` off. |
| <span id="getter-matrixwidth">**matrixWidth**</span><br><code>number</code> | The width the columns are laid out in: the rounded **content** width, so they still fill the drawn matrix when the genome doesn't reach across the viewport. Not `canvasWidthPx`, the viewport box a span maps bp into — the LD display's triangle takes the same width for the same reason. |
| <span id="getter-renderstate">**renderState**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ canvasWidth: number; canvasHeight: number; rowHeight: number;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ canvasWidth: number; canvasHeight: number; rowHeight: number; scrollTop: number; }</code></pre></dialog></span> |  |
| <span id="getter-gateenabled">**gateEnabled**</span><br><code>boolean</code> | Opt into RegionTooLargeMixin's byte gate. |
| <span id="getter-prefersoffset">**prefersOffset**</span><br><code>boolean</code> | Both layouts fill the track with rows, so an overlapping track label would sit on top of a sample's genotypes. |
| <span id="getter-awaitingprerequisite">**awaitingPrerequisite**</span><br><code>boolean</code> | `fetchNeeded` declines until `sourcesBase` lands, so the retry contract is judged on the run that follows (`FetchMixin.awaitingPrerequisite`). |
| <span id="getter-cellpaintoptions">**cellPaintOptions**</span><br><code>{ phased: boolean; valuesRead: boolean; }</code> | How the held payload's alt cells paint (`paintCellColors`). |
| <span id="getter-regionrecordalpha">**regionRecordAlpha**</span><br><code>Map&lt;number, Float32Array&lt;ArrayBufferLike&gt; &#124; undefined&gt;</code> | Each fetched region's records' alpha factors where they share pixels at genomic positions (`recordDensityAlpha`), so a zoomed-out row shades by the share of its records that are alt instead of filling wherever any is |
| <span id="getter-regioncellcolors">**regionCellColors**</span><br><code>Map&lt;number, Uint32Array&lt;ArrayBufferLike&gt;&gt;</code> | Each fetched region's cell colors through the current `encoding.color`, faded where records share pixels. Apart from the rows, so a reorder repaints nothing, and a recolor re-places nothing and refetches nothing. |
| <span id="getter-placedregionrows">**placedRegionRows**</span><br><code>Map&lt;number, Placed&lt;VariantCellData&gt;&gt;</code> | Each fetched region with its rows placed on screen. A computed apart from the colors, so a recolor leaves it standing. |
| <span id="getter-regioncellglyphs">**regionCellGlyphs**</span><br><code>Map&lt;number, CellGlyphs&gt;</code> | Each fetched region's cells as the `cell` mark's attributes: the record's span and glyph, which the payload holds once per record, dealt to each of its cells. Off `cellData` alone, since neither a reorder nor a recolor moves a cell's span. |
| <span id="getter-paintedregionrows">**paintedRegionRows**</span><br><code>Map&lt;number, Placed&lt;VariantCellData&gt;&gt;</code> | Each fetched region placed (`placedRegionRows`) and painted (`regionCellColors`), the cells both layouts draw. A reorder or a recolor changes an entry's identity and `installUpload` re-uploads with no RPC. A computed, because the overlay draws in an effect where nothing is tracked. |
| <span id="getter-perregioncellmap">**perRegionCellMap**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>Map&lt;number, VariantCellData &amp; { cellWorkerRowIndices: Uint32Arr…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>Map&lt;number, VariantCellData &amp; { cellWorkerRowIndices: Uint32Array&lt;ArrayBufferLike&gt;; } &amp; CellGlyphs&gt;</code></pre></dialog></span> | The one walk of the payload every genomic-position consumer reads: `paintedRegionRows` with the `cell` mark's attributes. |
| <span id="getter-columngeometry">**columnGeometry**</span><br><code>{ n: number; columnWidth: number; left: number; }</code> | Column pitch and origin in viewport pixels: `left` is where the content starts when it doesn't reach the left viewport edge. The connector lines, their hit test and the crosshair column all key off this, so columns, lines and clicks stay pixel-aligned. |
| <span id="getter-matrixblocks">**matrixBlocks**</span><br><code>RenderBlock[]</code> | The one block the column layout draws: the whole canvas, spanning the column indices. One column wide when there are none, since the GPU backend skips a block with no span and the canvas would never count as painted. |
| <span id="getter-connectorcoordsbycolumn">**connectorCoordsByColumn**</span><br><code>(ConnectorCoord &#124; undefined)[]</code> | One connector per column, **by column**, in viewport pixels: `mx` the column centre, `gx` the variant's position on the ruler, `label` what the hover tooltip shows. `undefined` where the variant's refName has left the view. Indexed rather than filtered, so the crosshair can ask of one column what the drawn field asks of all. Column and data index are one number: the worker ships the variants in screen order. |
| <span id="getter-connectorlinecoords">**connectorLineCoords**</span><br><code>ConnectorCoord[]</code> | The connector lines that draw: those with a genomic x. |
| <span id="getter-litrecordid">**litRecordId**</span><br><code>string &#124; undefined</code> | The band record the hover box lights: the one a menu opened on while it is open, else the one under the pointer, as LinearBasicDisplay's `hoverBoxFeature` picks. |
| <span id="getter-hoverink">**hoverInk**</span><br><code>HighlightRect[]</code> | The box of the lit record, over its glyph and its labels as LinearBasicDisplay boxes a feature, else of the hovered genotype cell. |
| <span id="getter-genotypehoverink">**genotypeHoverInk**</span><br><code>HighlightRect[]</code> | The box of the hovered genotype cell: its instance through the cell mark's ink, moved down by the bands above the rows. |
| <span id="getter-highlightstyle">**highlightStyle**</span><br><code>HighlightStyle</code> | A record shades as a feature track's feature does; a cell takes a wash and a border, since the cell colors are the data. |
| <span id="getter-featureindices">**featureIndices**</span><br><code>Map&lt;number, Flatbush&gt;</code> | Per-region spatial index over feature intervals, for the hit-test. One entry per variant, not per cell — see computeVariantCells. |
| <span id="getter-colorscales">**colorScales**</span><br><code>ColorScale[]</code> | `LegendMixin`'s hook: the records band's SV classes, the cell coloring while `cellColorKeyed`, and the row color key. |

<details class="inherited-members" data-pagefind-ignore>
<summary>132 inherited getters from 15 models</summary>

From [TreeSidebarMixin](../treesidebarmixin): <span id="getter-showtree">[`showTree`](../treesidebarmixin#getter-showtree)</span>, <span id="getter-showbranchlength">[`showBranchLength`](../treesidebarmixin#getter-showbranchlength)</span>, <span id="getter-showrowlabels">[`showRowLabels`](../treesidebarmixin#getter-showrowlabels)</span>, <span id="getter-treeareawidth">[`treeAreaWidth`](../treesidebarmixin#getter-treeareawidth)</span>, <span id="getter-rowsort">[`rowSort`](../treesidebarmixin#getter-rowsort)</span>, <span id="getter-rowlabels">[`rowLabels`](../treesidebarmixin#getter-rowlabels)</span>, <span id="getter-rowtreeprovenance">[`rowTreeProvenance`](../treesidebarmixin#getter-rowtreeprovenance)</span>, <span id="getter-rowfocus">[`rowFocus`](../treesidebarmixin#getter-rowfocus)</span>, <span id="getter-rowcolorsetting">[`rowColorSetting`](../treesidebarmixin#getter-rowcolorsetting)</span>, <span id="getter-baserowcolorsetting">[`baseRowColorSetting`](../treesidebarmixin#getter-baserowcolorsetting)</span>, <span id="getter-baserowsort">[`baseRowSort`](../treesidebarmixin#getter-baserowsort)</span>, <span id="getter-guidetreenewick">[`guideTreeNewick`](../treesidebarmixin#getter-guidetreenewick)</span>, <span id="getter-unlistedrowssort">[`unlistedRowsSort`](../treesidebarmixin#getter-unlistedrowssort)</span>, <span id="getter-rowfocuslineheight">[`rowFocusLineHeight`](../treesidebarmixin#getter-rowfocuslineheight)</span>, <span id="getter-rowstopoffset">[`rowsTopOffset`](../treesidebarmixin#getter-rowstopoffset)</span>, <span id="getter-guidetree">[`guideTree`](../treesidebarmixin#getter-guidetree)</span>, <span id="getter-guidetreehonoursdomain">[`guideTreeHonoursDomain`](../treesidebarmixin#getter-guidetreehonoursdomain)</span>, <span id="getter-rowtree">[`rowTree`](../treesidebarmixin#getter-rowtree)</span>, <span id="getter-roworder">[`rowOrder`](../treesidebarmixin#getter-roworder)</span>, <span id="getter-expandedrows">[`expandedRows`](../treesidebarmixin#getter-expandedrows)</span>, <span id="getter-sharespanel">[`sharesPanel`](../treesidebarmixin#getter-sharespanel)</span>, <span id="getter-rownoun">[`rowNoun`](../treesidebarmixin#getter-rownoun)</span>, <span id="getter-rowbandingnotices">[`rowBandingNotices`](../treesidebarmixin#getter-rowbandingnotices)</span>, <span id="getter-rowpalettedeals">[`rowPaletteDeals`](../treesidebarmixin#getter-rowpalettedeals)</span>, <span id="getter-rowcolordealrows">[`rowColorDealRows`](../treesidebarmixin#getter-rowcolordealrows)</span>, <span id="getter-rowcoloriscustom">[`rowColorIsCustom`](../treesidebarmixin#getter-rowcoloriscustom)</span>, <span id="getter-rowcolorchoice">[`rowColorChoice`](../treesidebarmixin#getter-rowcolorchoice)</span>, <span id="getter-rowcolorfield">[`rowColorField`](../treesidebarmixin#getter-rowcolorfield)</span>, <span id="getter-dealtvaluecolors">[`dealtValueColors`](../treesidebarmixin#getter-dealtvaluecolors)</span>, <span id="getter-rowcolorfieldsoffered">[`rowColorFieldsOffered`](../treesidebarmixin#getter-rowcolorfieldsoffered)</span>, <span id="getter-resolvedrowcolors">[`resolvedRowColors`](../treesidebarmixin#getter-resolvedrowcolors)</span>, <span id="getter-rowarrangementiscustom">[`rowArrangementIsCustom`](../treesidebarmixin#getter-rowarrangementiscustom)</span>, <span id="getter-editablesources">[`editableSources`](../treesidebarmixin#getter-editablesources)</span>, <span id="getter-rowcolorkeyinputs">[`rowColorKeyInputs`](../treesidebarmixin#getter-rowcolorkeyinputs)</span>, <span id="getter-rowcolorscales">[`rowColorScales`](../treesidebarmixin#getter-rowcolorscales)</span>, <span id="getter-clusterablesources">[`clusterableSources`](../treesidebarmixin#getter-clusterablesources)</span>, <span id="getter-parsedtree">[`parsedTree`](../treesidebarmixin#getter-parsedtree)</span>, <span id="getter-rotatablerowtree">[`rotatableRowTree`](../treesidebarmixin#getter-rotatablerowtree)</span>, <span id="getter-root">[`root`](../treesidebarmixin#getter-root)</span>, <span id="getter-bandedrows">[`bandedRows`](../treesidebarmixin#getter-bandedrows)</span>, <span id="getter-bandedsources">[`bandedSources`](../treesidebarmixin#getter-bandedsources)</span>, <span id="getter-rowbands">[`rowBands`](../treesidebarmixin#getter-rowbands)</span>, <span id="getter-sources">[`sources`](../treesidebarmixin#getter-sources)</span>, <span id="getter-treeroot">[`treeRoot`](../treesidebarmixin#getter-treeroot)</span>, <span id="getter-drawstree">[`drawsTree`](../treesidebarmixin#getter-drawstree)</span>, <span id="getter-awaitingdependentdata">[`awaitingDependentData`](../treesidebarmixin#getter-awaitingdependentdata)</span>, <span id="getter-rowscontentheight">[`rowsContentHeight`](../treesidebarmixin#getter-rowscontentheight)</span>, <span id="getter-hierarchy">[`hierarchy`](../treesidebarmixin#getter-hierarchy)</span>, <span id="getter-spatialindex">[`spatialIndex`](../treesidebarmixin#getter-spatialindex)</span>, <span id="getter-clusterpartition">[`clusterPartition`](../treesidebarmixin#getter-clusterpartition)</span>, <span id="getter-treelessbandcount">[`treelessBandCount`](../treesidebarmixin#getter-treelessbandcount)</span>, <span id="getter-treehasbranchlengths">[`treeHasBranchLengths`](../treesidebarmixin#getter-treehasbranchlengths)</span>

From [StoredHoverMixin](../storedhovermixin): <span id="getter-hoveredfeature">[`hoveredFeature`](../storedhovermixin#getter-hoveredfeature)</span>

From [RowHeightMixin](../rowheightmixin): <span id="getter-rowheight">[`rowHeight`](../rowheightmixin#getter-rowheight)</span>, <span id="getter-effectiverowheight">[`effectiveRowHeight`](../rowheightmixin#getter-effectiverowheight)</span>

From [FacetWritesMixin](../facetwritesmixin): <span id="getter-writtenfacet">[`writtenFacet`](../facetwritesmixin#getter-writtenfacet)</span>

From [ColorWritesMixin](../colorwritesmixin): <span id="getter-writtencolor">[`writtenColor`](../colorwritesmixin#getter-writtencolor)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="getter-parkedcolor">[`parkedColor`](../parkedcolormixin#getter-parkedcolor)</span>

From [LegendMixin](../legendmixin): <span id="getter-showlegend">[`showLegend`](../legendmixin#getter-showlegend)</span>, <span id="getter-legendright">[`legendRight`](../legendmixin#getter-legendright)</span>, <span id="getter-legendtop">[`legendTop`](../legendmixin#getter-legendtop)</span>, <span id="getter-legendspec">[`legendSpec`](../legendmixin#getter-legendspec)</span>, <span id="getter-haslegendkey">[`hasLegendKey`](../legendmixin#getter-haslegendkey)</span>

From [FeatureGateMixin](../featuregatemixin): <span id="getter-visiblefeaturedensityperpx">[`visibleFeatureDensityPerPx`](../featuregatemixin#getter-visiblefeaturedensityperpx)</span>, <span id="getter-maxfeaturedensity">[`maxFeatureDensity`](../featuregatemixin#getter-maxfeaturedensity)</span>, <span id="getter-densitytoolarge">[`densityTooLarge`](../featuregatemixin#getter-densitytoolarge)</span>

From [MultiRegionDisplayMixin](../multiregiondisplaymixin): <span id="getter-host">[`host`](../multiregiondisplaymixin#getter-host)</span>, <span id="getter-canvaswidthpx">[`canvasWidthPx`](../multiregiondisplaymixin#getter-canvaswidthpx)</span>, <span id="getter-settledsubpixelbinbp">[`settledSubPixelBinBp`](../multiregiondisplaymixin#getter-settledsubpixelbinbp)</span>, <span id="getter-canrender">[`canRender`](../multiregiondisplaymixin#getter-canrender)</span>, <span id="getter-renderscanvas">[`rendersCanvas`](../multiregiondisplaymixin#getter-renderscanvas)</span>, <span id="getter-trackvisibleregions">[`trackVisibleRegions`](../multiregiondisplaymixin#getter-trackvisibleregions)</span>, <span id="getter-viewportwithinloadeddata">[`viewportWithinLoadedData`](../multiregiondisplaymixin#getter-viewportwithinloadeddata)</span>, <span id="getter-viewportempty">[`viewportEmpty`](../multiregiondisplaymixin#getter-viewportempty)</span>, <span id="getter-fetchsuspended">[`fetchSuspended`](../multiregiondisplaymixin#getter-fetchsuspended)</span>, <span id="getter-datasuperseded">[`dataSuperseded`](../multiregiondisplaymixin#getter-datasuperseded)</span>, <span id="getter-renderblocks">[`renderBlocks`](../multiregiondisplaymixin#getter-renderblocks)</span>, <span id="getter-fetchinputs">[`fetchInputs`](../multiregiondisplaymixin#getter-fetchinputs)</span>, <span id="getter-regionpayloads">[`regionPayloads`](../multiregiondisplaymixin#getter-regionpayloads)</span>, <span id="getter-hasregiondata">[`hasRegionData`](../multiregiondisplaymixin#getter-hasregiondata)</span>, <span id="getter-stalesettingsdrawn">[`staleSettingsDrawn`](../multiregiondisplaymixin#getter-stalesettingsdrawn)</span>, <span id="getter-datacurrent">[`dataCurrent`](../multiregiondisplaymixin#getter-datacurrent)</span>, <span id="getter-loadedassembly">[`loadedAssembly`](../multiregiondisplaymixin#getter-loadedassembly)</span>, <span id="getter-phaseviewportcurrent">[`phaseViewportCurrent`](../multiregiondisplaymixin#getter-phaseviewportcurrent)</span>, <span id="getter-svgready">[`svgReady`](../multiregiondisplaymixin#getter-svgready)</span>, <span id="getter-paintinert">[`paintInert`](../multiregiondisplaymixin#getter-paintinert)</span>, <span id="getter-paintsuperseded">[`paintSuperseded`](../multiregiondisplaymixin#getter-paintsuperseded)</span>, <span id="getter-displayphase">[`displayPhase`](../multiregiondisplaymixin#getter-displayphase)</span>

From [FetchMixin](../fetchmixin): <span id="getter-isloading">[`isLoading`](../fetchmixin#getter-isloading)</span>, <span id="getter-isloadingorcanceled">[`isLoadingOrCanceled`](../fetchmixin#getter-isloadingorcanceled)</span>, <span id="getter-fetchinert">[`fetchInert`](../fetchmixin#getter-fetchinert)</span>, <span id="getter-settingsfetchinputs">[`settingsFetchInputs`](../fetchmixin#getter-settingsfetchinputs)</span>

From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="getter-painted">[`painted`](../renderlifecyclemixin#getter-painted)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="getter-bytegateadapterconfig">[`byteGateAdapterConfig`](../regiontoolargemixin#getter-bytegateadapterconfig)</span>, <span id="getter-configuredfetchsizelimit">[`configuredFetchSizeLimit`](../regiontoolargemixin#getter-configuredfetchsizelimit)</span>, <span id="getter-bytegateadapterpath">[`byteGateAdapterPath`](../regiontoolargemixin#getter-bytegateadapterpath)</span>, <span id="getter-adapterfetchsizelimit">[`adapterFetchSizeLimit`](../regiontoolargemixin#getter-adapterfetchsizelimit)</span>, <span id="getter-configforceload">[`configForceLoad`](../regiontoolargemixin#getter-configforceload)</span>, <span id="getter-gateviewportspanbp">[`gateViewportSpanBp`](../regiontoolargemixin#getter-gateviewportspanbp)</span>, <span id="getter-gateviewport">[`gateViewport`](../regiontoolargemixin#getter-gateviewport)</span>, <span id="getter-aboveforceloadfloor">[`aboveForceLoadFloor`](../regiontoolargemixin#getter-aboveforceloadfloor)</span>, <span id="getter-gateexempt">[`gateExempt`](../regiontoolargemixin#getter-gateexempt)</span>, <span id="getter-estimatedfetchbytes">[`estimatedFetchBytes`](../regiontoolargemixin#getter-estimatedfetchbytes)</span>, <span id="getter-gatemeasurementstale">[`gateMeasurementStale`](../regiontoolargemixin#getter-gatemeasurementstale)</span>, <span id="getter-gatebytelimit">[`gateByteLimit`](../regiontoolargemixin#getter-gatebytelimit)</span>, <span id="getter-gateactive">[`gateActive`](../regiontoolargemixin#getter-gateactive)</span>, <span id="getter-toolargestatus">[`tooLargeStatus`](../regiontoolargemixin#getter-toolargestatus)</span>, <span id="getter-regiontoolarge">[`regionTooLarge`](../regiontoolargemixin#getter-regiontoolarge)</span>, <span id="getter-regiontoolargereason">[`regionTooLargeReason`](../regiontoolargemixin#getter-regiontoolargereason)</span>, <span id="getter-zoomcanreleasegate">[`zoomCanReleaseGate`](../regiontoolargemixin#getter-zoomcanreleasegate)</span>, <span id="getter-gateskipsmeasuredviewport">[`gateSkipsMeasuredViewport`](../regiontoolargemixin#getter-gateskipsmeasuredviewport)</span>

From [HeightModeMixin](../heightmodemixin): <span id="getter-heightmode">[`heightMode`](../heightmodemixin#getter-heightmode)</span>, <span id="getter-fittargetheight">[`fitTargetHeight`](../heightmodemixin#getter-fittargetheight)</span>, <span id="getter-autoheight">[`autoHeight`](../heightmodemixin#getter-autoheight)</span>, <span id="getter-fitheighttodisplay">[`fitHeightToDisplay`](../heightmodemixin#getter-fitheighttodisplay)</span>, <span id="getter-grownheight">[`grownHeight`](../heightmodemixin#getter-grownheight)</span>

From [TrackHeightMixin](../trackheightmixin): <span id="getter-configuredheight">[`configuredHeight`](../trackheightmixin#getter-configuredheight)</span>, <span id="getter-allottedheight">[`allottedHeight`](../trackheightmixin#getter-allottedheight)</span>, <span id="getter-resizing">[`resizing`](../trackheightmixin#getter-resizing)</span>, <span id="getter-scrollableheight">[`scrollableHeight`](../trackheightmixin#getter-scrollableheight)</span>

From [BaseDisplay](../basedisplay): <span id="getter-parenttrack">[`parentTrack`](../basedisplay#getter-parenttrack)</span>, <span id="getter-renderingcomponent">[`RenderingComponent`](../basedisplay#getter-renderingcomponent)</span>, <span id="getter-displayblurb">[`DisplayBlurb`](../basedisplay#getter-displayblurb)</span>, <span id="getter-adapterconfig">[`adapterConfig`](../basedisplay#getter-adapterconfig)</span>, <span id="getter-isminimized">[`isMinimized`](../basedisplay#getter-isminimized)</span>, <span id="getter-plotkeys">[`plotKeys`](../basedisplay#getter-plotkeys)</span>, <span id="getter-plot">[`plot`](../basedisplay#getter-plot)</span>, <span id="getter-confignotices">[`configNotices`](../basedisplay#getter-confignotices)</span>, <span id="getter-notices">[`notices`](../basedisplay#getter-notices)</span>, <span id="getter-cornernotices">[`cornerNotices`](../basedisplay#getter-cornernotices)</span>, <span id="getter-plotexamples">[`plotExamples`](../basedisplay#getter-plotexamples)</span>, <span id="getter-configdocsurl">[`configDocsUrl`](../basedisplay#getter-configdocsurl)</span>

</details>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-featureinfobyid">**featureInfoById**</span><br><code>(featureId: string) =&gt; VariantFeatureInfo &#124; undefined</code> | The payload's record behind a cell. |
| <span id="method-simplifiedfeaturebyid">**simplifiedFeatureById**</span><br><code>(featureId: string) =&gt; SimplifiedVariantFeature &#124; undefined</code> | The payload's positional record behind a cell. |
| <span id="method-regionhasdata">**regionHasData**</span><br><code>(displayedRegionIndex: number) =&gt; boolean</code> | Whether the held payload was fetched for this region: a batched fetch replaces the whole payload, so a region an earlier batch loaded keeps its `loadedRegions` entry with nothing behind it. In columns, also whether it was fetched at the zoom on screen. |
| <span id="method-configuredfilters">**configuredFilters**</span><br><code>() =&gt; string[]</code> | The `jexl:` expressions the `filter` list holds. |
| <span id="method-basefilters">**baseFilters**</span><br><code>() =&gt; string[]</code> | The expressions the track's config declares, which "Clear all filters" returns to. |
| <span id="method-featurebyid">**featureById**</span><br><code>(featureId: string) =&gt; Feature &#124; undefined</code> | The record a click on the rows or the matrix resolved to, positional fields only: its genotypes are in the cell payload. |
| <span id="method-recordmenuhit">**recordMenuHit**</span><br><code>(feature: Feature) =&gt; FeatureMenuHit &#124; undefined</code> | The right-clicked record as the hit plugin-features's feature menu rows act on, in the displayed region holding its first base. |
| <span id="method-expandrows">**expandRows**</span><br><code>(rows: ProcessedSource[]) =&gt; ProcessedSource[]</code> | `TreeSidebarMixin`'s hook: phased mode draws a row per haplotype, once `samplePloidy` lands or the order names them. |
| <span id="method-rpcprops">**rpcProps**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; { layout: "columns" &#124; "genomic"; sampleFilter: string[] &#124;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; { layout: "columns" &#124; "genomic"; sampleFilter: string[] &#124; undefined; siteFilter: FieldPredicate[]; filters: SerializableFilterChain &#124; undefined; unit: "haplotype" &#124; "sample"; color: CellHueRead; recordFields: RecordFieldReads; showReference: boolean; }</code></pre></dialog></span> |  |
| <span id="method-searchfeaturebyid">**searchFeatureByID**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(id: string) =&gt; readonly [number, number, number, number] &#124; und…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(id: string) =&gt; readonly [number, number, number, number] &#124; undefined</code></pre></dialog></span> | Where a record drew, `[startBp, top, endBp, bottom]`, as a feature track answers it: the breakpoint split view's overlay subtracts the display's `scrollTop`, so the top is the band's own, which over rows does not scroll. A record the band hides is not found. |
| <span id="method-recordsink">**recordsInk**</span><br><code>(featureIds: Iterable&lt;string&gt;) =&gt; HighlightRect[]</code> | One box per region per record, over its glyph and the labels the band drew for it, in the display's px, as LinearBasicDisplay boxes a feature. |
| <span id="method-recordsdrawnlabeltexts">**recordsDrawnLabelTexts**</span><br><code>(featureId: string) =&gt; Set&lt;string&gt;</code> | The text of every label the band drew for a record, which its hover tooltip leaves out, as a feature track's does. |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |
| <span id="method-contextmenuitems">**contextMenuItems**</span><br><code>() =&gt; MenuItem[]</code> | Items for the right-click menu, built from the record in `contextMenuInfo`. |
| <span id="method-connectorlineatscreenx">**connectorLineAtScreenX**</span><br><code>(screenX: number) =&gt; ConnectorCoord &#124; undefined</code> | The connector for the column under `screenX` (the crosshair), or undefined off the ends and over a column with no genomic x. |
| <span id="method-rendersvg">**renderSvg**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(opts?: ExportSvgDisplayOptions &#124; undefined) =&gt; Promise&lt;ReactEl…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(opts?: ExportSvgDisplayOptions &#124; undefined) =&gt; Promise&lt;ReactElement&lt;unknown, string &#124; JSXElementConstructor&lt;any&gt;&gt; &#124; Iterable&lt;ReactNode&gt; &#124; AwaitedReactNode&gt;</code></pre></dialog></span> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>19 inherited methods from 7 models</summary>

From [TreeSidebarMixin](../treesidebarmixin): <span id="method-svgsidebarwidth">[`svgSidebarWidth`](../treesidebarmixin#method-svgsidebarwidth)</span>, <span id="method-rowband">[`rowBand`](../treesidebarmixin#method-rowband)</span>, <span id="method-rowcolordeclaredvalues">[`rowColorDeclaredValues`](../treesidebarmixin#method-rowcolordeclaredvalues)</span>, <span id="method-dealtvaluecolorsfor">[`dealtValueColorsFor`](../treesidebarmixin#method-dealtvaluecolorsfor)</span>, <span id="method-rowcolorfor">[`rowColorFor`](../treesidebarmixin#method-rowcolorfor)</span>, <span id="method-orderdropsrowtree">[`orderDropsRowTree`](../treesidebarmixin#method-orderdropsrowtree)</span>, <span id="method-roworderwilldroptree">[`rowOrderWillDropTree`](../treesidebarmixin#method-roworderwilldroptree)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="method-parkedcolorof">[`parkedColorOf`](../parkedcolormixin#method-parkedcolorof)</span>

From [LegendMixin](../legendmixin): <span id="method-colorscalesin">[`colorScalesIn`](../legendmixin#method-colorscalesin)</span>, <span id="method-legendspecin">[`legendSpecIn`](../legendmixin#method-legendspecin)</span>

From [FeatureGateMixin](../featuregatemixin): <span id="method-observedmaxdensity">[`observedMaxDensity`](../featuregatemixin#method-observedmaxdensity)</span>

From [MultiRegionDisplayMixin](../multiregiondisplaymixin): <span id="method-iscachevalid">[`isCacheValid`](../multiregiondisplaymixin#method-iscachevalid)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="method-resolvedbytelimit">[`resolvedByteLimit`](../regiontoolargemixin#method-resolvedbytelimit)</span>, <span id="method-gatefetchstate">[`gateFetchState`](../regiontoolargemixin#method-gatefetchstate)</span>

From [BaseDisplay](../basedisplay): <span id="method-renderingprops">[`renderingProps`](../basedisplay#method-renderingprops)</span>, <span id="method-configproblemsof">[`configProblemsOf`](../basedisplay#method-configproblemsof)</span>, <span id="method-liftplot">[`liftPlot`](../basedisplay#method-liftplot)</span>, <span id="method-plotproblems">[`plotProblems`](../basedisplay#method-plotproblems)</span>, <span id="method-plotwrites">[`plotWrites`](../basedisplay#method-plotwrites)</span>

</details>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-sethoveredcell">**setHoveredCell**</span><br><code>(cell?: HoveredCell &#124; undefined) =&gt; void</code> |  |
| <span id="action-sethoveredrecord">**setHoveredRecord**</span><br><code>(record?: HitFeatureResult &#124; undefined) =&gt; void</code> |  |
| <span id="action-sethoveredmatrixcell">**setHoveredMatrixCell**</span><br><code>(cell?: MatrixHoveredCell &#124; undefined) =&gt; void</code> |  |
| <span id="action-clearhoveredfeature">**clearHoveredFeature**</span><br><code>() =&gt; void</code> | `StoredHoverMixin`'s clears the tooltip; the highlight boxes go with it. |
| <span id="action-setcelldata">**setCellData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(data: CellDataResult &#124; undefined, displayedRegionIndices?: Ite…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(data: CellDataResult &#124; undefined, displayedRegionIndices?: Iterable&lt;number&gt;, bpPerPx?: number &#124; undefined) =&gt; void</code></pre></dialog></span> | Store a payload and the regions it covers. One payload serves every region of a fetch and replaces the last one whole, so this is also where the previous batch's regions stop having data behind them, and where a hover indexing the old payload's cells goes. |
| <span id="action-setfilter">**setFilter**</span><br><code>(f?: string[] &#124; undefined) =&gt; void</code> |  |
| <span id="action-fetchadaptermetadata">**fetchAdapterMetadata**</span><br><code>() =&gt; Promise&lt;unknown&gt;</code> | The adapter's header metadata, fetched once per adapter config. |
| <span id="action-fetchfullrecord">**fetchFullRecord**</span><br><code>(feature: Feature) =&gt; Promise&lt;Feature&gt;</code> | The clicked record as the adapter holds it, INFO and every sample included, as LinearBasicDisplay's `fetchFullFeature` reads it: the cell payload carries positions and genotype codes, no INFO. The clicked cell's sample card rides along; the click's own record where the adapter finds none. |
| <span id="action-selectfeature">**selectFeature**</span><br><code>(feature: Feature) =&gt; void</code> |  |
| <span id="action-clearselection">**clearSelection**</span><br><code>() =&gt; void</code> |  |
| <span id="action-fetchfullfeature">**fetchFullFeature**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(featureId: string, _displayedRegionIndex: number, opts?: { sig…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(featureId: string, _displayedRegionIndex: number, opts?: { signal?: AbortSignal &#124; undefined; }) =&gt; Promise&lt;SimpleFeature &#124; undefined&gt;</code></pre></dialog></span> | A drawn record as the adapter holds it, INFO and every sample included, as LinearBasicDisplay's `fetchFullFeature` answers its feature menu's copy and sequence rows. |
| <span id="action-setsequencehoverposition">**setSequenceHoverPosition**</span><br><code>(_pos: SequenceHoverPosition &#124; undefined) =&gt; void</code> | Where the sequence dialog's pointer is, which a feature track boxes on its glyph. A record's sequence is its REF span, so nothing here draws it. |
| <span id="action-setsources">**setSources**</span><br><code>(sources: Source[], adapterConfig?: any) =&gt; void</code> |  |
| <span id="action-setrowcolorchoice">**setRowColorChoice**</span><br><code>(choice: string) =&gt; void</code> | The mixin's, then a warning naming a metadata field no sample carries. The tint is resolved on every read of `sources`, so a recolor moves no rows and drops no cluster tree. |
| <span id="action-setminminorallelefrequency">**setMinMinorAlleleFrequency**</span><br><code>(arg: number) =&gt; void</code> |  |
| <span id="action-setmaxmissingness">**setMaxMissingness**</span><br><code>(arg: number) =&gt; void</code> |  |
| <span id="action-setfittoheight">**setFitToHeight**</span><br><code>() =&gt; void</code> | Enable fit-to-display-height mode: `rowHeight = 0` makes `effectiveRowHeight` divide `availableHeight` across the rows. |
| <span id="action-setshowreference">**setShowReference**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setshowrowseparators">**setShowRowSeparators**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setshowtooltips">**setShowTooltips**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-opensolidcolordialog">**openSolidColorDialog**</span><br><code>() =&gt; void</code> | the picker Color by's Solid color... opens |
| <span id="action-setvariantlayout">**setVariantLayout**</span><br><code>(arg: "columns" &#124; "genomic") =&gt; void</code> |  |
| <span id="action-setlinezoneheight">**setLineZoneHeight**</span><br><code>(n: number) =&gt; void</code> |  |
| <span id="action-setshowgenotypes">**setShowGenotypes**</span><br><code>(arg: boolean) =&gt; void</code> | Draw the genotype rows, or the records alone. |
| <span id="action-setbackenddrawscolumns">**setBackendDrawsColumns**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setshowrecords">**setShowRecords**</span><br><code>(arg: boolean) =&gt; void</code> | Switch the records band on or off; over rows it adds its height to the track above them. |
| <span id="action-setrecordsdisplaymode">**setRecordsDisplayMode**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(mode: "collapsed" &#124; "compact" &#124; "normal" &#124; "superCompact") =&gt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(mode: "collapsed" &#124; "compact" &#124; "normal" &#124; "superCompact") =&gt; void</code></pre></dialog></span> | `records.displayMode`, each record's height preset. |
| <span id="action-setrecordslabelshow">**setRecordsLabelShow**</span><br><code>(kind: "description" &#124; "name", show: boolean) =&gt; void</code> | Show or hide one label kind of the records. |
| <span id="action-recordsfacetbyfield">**recordsFacetByField**</span><br><code>(field: string) =&gt; void</code> | Split the records into sections by `field`, `''` for none, keeping the order and hidden sections while it is the field already grouping. |
| <span id="action-setrecordsfacetsort">**setRecordsFacetSort**</span><br><code>(sort: readonly string[]) =&gt; void</code> | The order the record sections take, the ones it names first. |
| <span id="action-hiderecordsgroup">**hideRecordsGroup**</span><br><code>(key: string) =&gt; void</code> | Drop a record section from the band; `showAllRecordsGroups` brings it back. |
| <span id="action-showallrecordsgroups">**showAllRecordsGroups**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setrecordsheight">**setRecordsHeight**</span><br><code>(arg: number) =&gt; void</code> | Set the records band's height, clamped here because a drag can deliver any number and a band dragged shut has to stay grabbable. |
| <span id="action-showallrecordrows">**showAllRecordRows**</span><br><code>() =&gt; void</code> | Raise the band to its whole stack, so no record row hides. |
| <span id="action-settlerecordsbandheight">**settleRecordsBandHeight**</span><br><code>() =&gt; void</code> | Write the band's height over rows once, at its first layout with a record on screen: what it draws then, its stack up to the default. From then on a pan fits the records inside the band rather than resizing it, and a region with no record before that spends nothing. |
| <span id="action-settlerecordsopeningheight">**settleRecordsOpeningHeight**</span><br><code>() =&gt; void</code> | Size a records-only track once, at its first layout with a record on screen: its `full` stack up to the slot's `height`, so a sparse window opens compact. Over rows, under `grow`, inside a ring, or with a `height` a config, a session or a drag wrote, it keeps the height it has. Never again for this display, so a pan into a denser window fits the records inside the box rather than moving it. |
| <span id="action-setfeaturehighlights">**setFeatureHighlights**</span><br><code>(highlights: FeatureHighlight[]) =&gt; void</code> |  |
| <span id="action-setsearchhighlight">**setSearchHighlight**</span><br><code>(highlight: FeatureHighlight) =&gt; void</code> | A text search's highlight replaces the previous search's and leaves the right-click ones, which have a `featureId`, alone. |
| <span id="action-addfeaturehighlightforitem">**addFeatureHighlightForItem**</span><br><code>(target: HighlightTarget, refName: string) =&gt; void</code> |  |
| <span id="action-removefeaturehighlightsforid">**removeFeatureHighlightsForId**</span><br><code>(featureId: string) =&gt; void</code> |  |
| <span id="action-clearfeaturehighlights">**clearFeatureHighlights**</span><br><code>() =&gt; void</code> |  |
| <span id="action-sortbygenotype">**sortByGenotype**</span><br><code>(featureId: string) =&gt; boolean</code> | Order the rows by their genotype at one variant, then at the other records spanning its reference interval (a site split one record per ALT), then by how far each row agrees with its neighbours to either side. Sorts `editableSources`, so the order written names every row. |
| <span id="action-sortrowsbygenotypeat">**sortRowsByGenotypeAt**</span><br><code>(refName: string, pos: number) =&gt; boolean</code> | `sortByGenotype` at a genomic column, the declarative `sortRowsBy` entry point. Anchors on the record a click there picks (`pickVariantCell`): the shortest covering the column, the later of two as short. Returns whether it sorted, so `sortRowsBy` stays set for the fetch that brings a record to the column. `refName` arrives canonical; a record's is whatever the file spelled. |
| <span id="action-setunit">**setUnit**</span><br><code>(unit: "haplotype" &#124; "sample") =&gt; void</code> |  |
| <span id="action-applyplot">**applyPlot**</span><br><code>(draft: Plot, options?: PlotWriteOptions &#124; undefined) =&gt; void</code> | `BaseDisplay`'s, resetting the row arrangement when it moves `unit`. |
| <span id="action-applydisplaysettings">**applyDisplaySettings**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(settings: Record&lt;string, unknown&gt;, options?: { allowSetters?:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(settings: Record&lt;string, unknown&gt;, options?: { allowSetters?: boolean &#124; undefined; } &#124; undefined) =&gt; { applied: string[]; unapplied: UnappliedSetting[]; failed: { key: string; error: string; }[]; }</code></pre></dialog></span> | `BaseDisplay`'s, resetting the row arrangement when it moves `unit`, and then writing the `rows` and `rowColor` the settings state, which name the rows at the new unit. |
| <span id="action-cleardisplayspecificdata">**clearDisplaySpecificData**</span><br><code>() =&gt; void</code> |  |
| <span id="action-clearsettingsbakeddata">**clearSettingsBakedData**</span><br><code>() =&gt; void</code> |  |
| <span id="action-fetchneeded">**fetchNeeded**</span><br><code>(_needed: IndexedRegion[]) =&gt; Promise&lt;void&gt;</code> |  |
| <span id="action-startrenderingbackend">**startRenderingBackend**</span><br><code>(backend: VariantLayoutBackend) =&gt; void</code> | The layout's chrome hands over its backend; a layout switch mounts the other chrome, whose backend replaces this one. The upload lifecycle is installed once, so its cells and its render follow the backend attached rather than the setting: until the other chrome's backend arrives, the old one is sent nothing it cannot draw. |

<details class="inherited-members" data-pagefind-ignore>
<summary>67 inherited actions from 15 models</summary>

From [ContextMenuMixin](../contextmenumixin): <span id="action-opencontextmenu">[`openContextMenu`](../contextmenumixin#action-opencontextmenu)</span>, <span id="action-closecontextmenu">[`closeContextMenu`](../contextmenumixin#action-closecontextmenu)</span>

From [TreeSidebarMixin](../treesidebarmixin): <span id="action-setshowtree">[`setShowTree`](../treesidebarmixin#action-setshowtree)</span>, <span id="action-setshowbranchlength">[`setShowBranchLength`](../treesidebarmixin#action-setshowbranchlength)</span>, <span id="action-setshowrowlabels">[`setShowRowLabels`](../treesidebarmixin#action-setshowrowlabels)</span>, <span id="action-settreeareawidth">[`setTreeAreaWidth`](../treesidebarmixin#action-settreeareawidth)</span>, <span id="action-setrunclustering">[`setRunClustering`](../treesidebarmixin#action-setrunclustering)</span>, <span id="action-setclusterregion">[`setClusterRegion`](../treesidebarmixin#action-setclusterregion)</span>, <span id="action-setsortrowsby">[`setSortRowsBy`](../treesidebarmixin#action-setsortrowsby)</span>, <span id="action-sethoveredtreenode">[`setHoveredTreeNode`](../treesidebarmixin#action-sethoveredtreenode)</span>, <span id="action-settreecanvasref">[`setTreeCanvasRef`](../treesidebarmixin#action-settreecanvasref)</span>, <span id="action-setmouseovercanvasref">[`setMouseoverCanvasRef`](../treesidebarmixin#action-setmouseovercanvasref)</span>, <span id="action-setroworder">[`setRowOrder`](../treesidebarmixin#action-setroworder)</span>, <span id="action-setrowlabels">[`setRowLabels`](../treesidebarmixin#action-setrowlabels)</span>, <span id="action-setrowfocus">[`setRowFocus`](../treesidebarmixin#action-setrowfocus)</span>, <span id="action-applyrowedits">[`applyRowEdits`](../treesidebarmixin#action-applyrowedits)</span>, <span id="action-resetrowarrangement">[`resetRowArrangement`](../treesidebarmixin#action-resetrowarrangement)</span>, <span id="action-focuslegendentry">[`focusLegendEntry`](../treesidebarmixin#action-focuslegendentry)</span>

From [StoredHoverMixin](../storedhovermixin): <span id="action-sethoveredfeature">[`setHoveredFeature`](../storedhovermixin#action-sethoveredfeature)</span>

From [RowHeightMixin](../rowheightmixin): <span id="action-setrowheight">[`setRowHeight`](../rowheightmixin#action-setrowheight)</span>

From [FacetWritesMixin](../facetwritesmixin): <span id="action-facetbyfield">[`facetByField`](../facetwritesmixin#action-facetbyfield)</span>, <span id="action-setfacetsort">[`setFacetSort`](../facetwritesmixin#action-setfacetsort)</span>

From [ColorWritesMixin](../colorwritesmixin): <span id="action-colorbyfield">[`colorByField`](../colorwritesmixin#action-colorbyfield)</span>, <span id="action-setcolorvalue">[`setColorValue`](../colorwritesmixin#action-setcolorvalue)</span>, <span id="action-pickdefaultcolor">[`pickDefaultColor`](../colorwritesmixin#action-pickdefaultcolor)</span>, <span id="action-picksolidcolor">[`pickSolidColor`](../colorwritesmixin#action-picksolidcolor)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="action-parkcolor">[`parkColor`](../parkedcolormixin#action-parkcolor)</span>

From [LegendMixin](../legendmixin): <span id="action-setshowlegend">[`setShowLegend`](../legendmixin#action-setshowlegend)</span>, <span id="action-dismisslegendsection">[`dismissLegendSection`](../legendmixin#action-dismisslegendsection)</span>

From [FeatureGateMixin](../featuregatemixin): <span id="action-setdensitystats">[`setDensityStats`](../featuregatemixin#action-setdensitystats)</span>, <span id="action-cleargatemeasurements">[`clearGateMeasurements`](../featuregatemixin#action-cleargatemeasurements)</span>, <span id="action-commitgatemeasurements">[`commitGateMeasurements`](../featuregatemixin#action-commitgatemeasurements)</span>

From [MultiRegionDisplayMixin](../multiregiondisplaymixin): <span id="action-setloadedregion">[`setLoadedRegion`](../multiregiondisplaymixin#action-setloadedregion)</span>, <span id="action-evictregionstore">[`evictRegionStore`](../multiregiondisplaymixin#action-evictregionstore)</span>, <span id="action-droploadedregion">[`dropLoadedRegion`](../multiregiondisplaymixin#action-droploadedregion)</span>, <span id="action-clearallrpcdata">[`clearAllRpcData`](../multiregiondisplaymixin#action-clearallrpcdata)</span>, <span id="action-invalidatesettings">[`invalidateSettings`](../multiregiondisplaymixin#action-invalidatesettings)</span>, <span id="action-reload">[`reload`](../multiregiondisplaymixin#action-reload)</span>, <span id="action-fetchregions">[`fetchRegions`](../multiregiondisplaymixin#action-fetchregions)</span>, <span id="action-afterattach">[`afterAttach`](../multiregiondisplaymixin#action-afterattach)</span>

From [FetchMixin](../fetchmixin): <span id="action-seterror">[`setError`](../fetchmixin#action-seterror)</span>, <span id="action-setstatusmessage">[`setStatusMessage`](../fetchmixin#action-setstatusmessage)</span>, <span id="action-stopactivefetch">[`stopActiveFetch`](../fetchmixin#action-stopactivefetch)</span>, <span id="action-openstatusstream">[`openStatusStream`](../fetchmixin#action-openstatusstream)</span>, <span id="action-cancelfetch">[`cancelFetch`](../fetchmixin#action-cancelfetch)</span>, <span id="action-cancelfetchbyuser">[`cancelFetchByUser`](../fetchmixin#action-cancelfetchbyuser)</span>, <span id="action-beforedestroy">[`beforeDestroy`](../fetchmixin#action-beforedestroy)</span>, <span id="action-beginfetch">[`beginFetch`](../fetchmixin#action-beginfetch)</span>, <span id="action-endfetch">[`endFetch`](../fetchmixin#action-endfetch)</span>, <span id="action-runfetch">[`runFetch`](../fetchmixin#action-runfetch)</span>

From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="action-markcanvasdrawn">[`markCanvasDrawn`](../renderlifecyclemixin#action-markcanvasdrawn)</span>, <span id="action-resetcanvasdrawn">[`resetCanvasDrawn`](../renderlifecyclemixin#action-resetcanvasdrawn)</span>, <span id="action-stoprenderingbackend">[`stopRenderingBackend`](../renderlifecyclemixin#action-stoprenderingbackend)</span>, <span id="action-rendernow">[`renderNow`](../renderlifecyclemixin#action-rendernow)</span>, <span id="action-setoffscreen">[`setOffScreen`](../renderlifecyclemixin#action-setoffscreen)</span>, <span id="action-setrendererror">[`setRenderError`](../renderlifecyclemixin#action-setrendererror)</span>, <span id="action-attachrenderingbackend">[`attachRenderingBackend`](../renderlifecyclemixin#action-attachrenderingbackend)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="action-clearbyteestimate">[`clearByteEstimate`](../regiontoolargemixin#action-clearbyteestimate)</span>, <span id="action-setforceloadtrack">[`setForceLoadTrack`](../regiontoolargemixin#action-setforceloadtrack)</span>, <span id="action-commitfetchbytes">[`commitFetchBytes`](../regiontoolargemixin#action-commitfetchbytes)</span>, <span id="action-forceload">[`forceLoad`](../regiontoolargemixin#action-forceload)</span>

From [HeightModeMixin](../heightmodemixin): <span id="action-setheightmode">[`setHeightMode`](../heightmodemixin#action-setheightmode)</span>, <span id="action-resizeheight">[`resizeHeight`](../heightmodemixin#action-resizeheight)</span>

From [TrackHeightMixin](../trackheightmixin): <span id="action-setscrolltop">[`setScrollTop`](../trackheightmixin#action-setscrolltop)</span>, <span id="action-sethostheight">[`setHostHeight`](../trackheightmixin#action-sethostheight)</span>, <span id="action-setheight">[`setHeight`](../trackheightmixin#action-setheight)</span>, <span id="action-expandtocontentheight">[`expandToContentHeight`](../trackheightmixin#action-expandtocontentheight)</span>

</details>
