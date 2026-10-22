---
id: linearbasicdisplay
title: LinearBasicDisplay
description: "Draws the genes and other features of a FeatureTrack, from a BED, GFF or similar file. The display adds the gene-glyph slots (isoforms, subparts, UTRs, chevrons) to the shared canvas base."
sidebar_label: Display -> LinearBasicDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/configSchema.ts).

Draws the genes and other features of a `FeatureTrack`, from a BED, GFF or
similar file. The display adds the gene-glyph slots (isoforms, subparts,
UTRs, chevrons) to the shared canvas base. The color slots `color`,
`connectorColor` and `utrColor` are display-level, set inside a track's
`displays` array, each a CSS color or a `jexl:` expression for per-feature
coloring.

## Example usage

A complete `FeatureTrack` config (e.g. genes from a GFF3) to paste into
`tracks`. `displayMode` sets the feature height preset (`normal`, `compact`,
or `superCompact`), or `collapsed` for a single-row overview:

```js
{
  type: 'FeatureTrack',
  trackId: 'genes',
  name: 'Genes',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://example.com/genes.gff3.gz',
  },
  displays: [
    {
      type: 'LinearBasicDisplay',
      displayId: 'genes-LinearBasicDisplay',
      height: 200,
      displayMode: 'compact',
    },
  ],
}
```

## Related links

- **Adapter:** [BedAdapter](../bedadapter)
- **Adapter:** [BedTabixAdapter](../bedtabixadapter)
- **Adapter:** [BigBedAdapter](../bigbedadapter)
- **Adapter:** [CrisprGuideAdapter](../crisprguideadapter)
- **Adapter:** [FromConfigAdapter](../fromconfigadapter)
- **Adapter:** [Gff3Adapter](../gff3adapter)
- **Adapter:** [Gff3TabixAdapter](../gff3tabixadapter)
- **Adapter:** [GtfAdapter](../gtfadapter)
- **Adapter:** [GtfTabixAdapter](../gtftabixadapter)
- **Adapter:** [NCListAdapter](../nclistadapter)
- **Adapter:** [SequenceSearchAdapter](../sequencesearchadapter)
- **Adapter:** [SPARQLAdapter](../sparqladapter)
- **State model:** [runtime API](../../models/linearbasicdisplay)
- **Base config:** [LinearCanvasBaseDisplay](../linearcanvasbasedisplay)

## Config slots

Display slots go on a display entry: `"displays": [{ "type": "LinearBasicDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>5000000</code> | Feature (GFF/BED) tracks are light text, and the tabix byte estimate is block-granular (a small region still pulls whole BGZF blocks), so a single gene can trip a tighter gate.<br>_advanced_ |
| <span id="slot-filter">**filter**</span><br>[BasicFeatureFilter](../basicfeaturefilter) | The features the display draws: the jexl `expressions`, and `genes`, the gene-like features as a category. |
| <span id="slot-connectorcolor">**connectorColor**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color of the connecting/intron lines between feature segments (defaults to the theme text color)<br>_callback args:_ `feature` |
| <span id="slot-utrcolor">**utrColor**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | fill color for UTRs on gene/transcript glyphs. Unset, a feature's own BED itemRgb paints them too (matching UCSC's whole-item coloring), else a contrasting blue<br>_callback args:_ `feature` |
| <span id="slot-geneglyphmode">**geneGlyphMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, all, longestCoding) = <code>'auto'</code> | Gene glyph display mode: "auto" collapses each gene to one transcript when zoomed out and trims the rest to what the track height holds, "all" draws every transcript and scrolls the surplus instead of trimming, "longestCoding" shows one transcript per gene — the one canonicalTranscriptTags names, else the longest coding |
| <span id="slot-subfeaturelabels">**subfeatureLabels**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, none, below, overlay) = <code>GENE_GLYPH_DEFAULTS.subfeatureLabels</code> | subfeature label display mode: `auto` (the default) names a polyprotein's cleavage products on their rows and nothing else; `none`, `below` or `overlay` apply to every part |
| <span id="slot-showchevrons">**showChevrons**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw chevrons on intron lines pointing the way the feature reads |
| <span id="slot-transcripttypes">**transcriptTypes**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>GENE_GLYPH_DEFAULTS.transcriptTypes</code> | feature types the gene category (`filter.genes`) counts beside every gene, transcript and RNA type, plus the fallback for recognizing a CHILDLESS transcript as one of a gene's isoforms. |
| <span id="slot-canonicaltranscriptfield">**canonicalTranscriptField**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>GENE_GLYPH_DEFAULTS.canonicalTranscriptField</code> | feature attribute holding an isoform's curated "this one represents the gene" tag. |
| <span id="slot-canonicaltranscripttags">**canonicalTranscriptTags**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>GENE_GLYPH_DEFAULTS.canonicalTranscriptTags</code> | values of that attribute that mark an isoform as the gene's representative one, which is then ranked ahead of every other isoform: it is the transcript shown by `longestCoding`, and the first kept when `auto` caps a gene at the rows the track has. |
| <span id="slot-containertypes">**containerTypes**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>GENE_GLYPH_DEFAULTS.containerTypes</code> | top-level feature types that always stack their children on separate rows. |
| <span id="slot-subparts">**subParts**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>GENE_GLYPH_DEFAULTS.subParts</code> | subparts for a glyph |
| <span id="slot-impliedutrs">**impliedUTRs**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>GENE_GLYPH_DEFAULTS.impliedUTRs</code> | draw the stretch of each exon outside the CDS that no UTR row covers as a UTR, or with no exon rows, a CDS end no UTR row reaches out to the transcript bounds |
| <span class="slot-group">Inherited from [LinearCanvasBaseDisplay](../linearcanvasbasedisplay)</span> | <span class="slot-group-count">17 slots</span> |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature; left at the default, the tooltip adds the description line (`labels.description`) as a second row<br>_callback args:_ `feature` |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message<br>_advanced_ |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | show the display's color key when it has one: the key a `color` field derives, or a variant track's consequence-impact / SV-type presets. |
| <span id="slot-showlabels">**showLabels**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, nameAndDescription, name, description, none) = <code>'auto'</code> | Label text drawn beside each feature: "auto" adapts to zoom, dropping descriptions at maxDescriptionFeatureDensity and names at maxLabelFeatureDensity; "nameAndDescription", "name", "description", and "none" pin a choice at every zoom. Defaults to `auto`. Replaces the former showLabels on/off enum + showDescriptions boolean pair |
| <span id="slot-maxlabelfeaturedensity">**maxLabelFeatureDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0.2</code> | In "auto" showLabels mode, hide labels when visible feature density (features/pixel) exceeds this value<br>_advanced_ |
| <span id="slot-maxdescriptionfeaturedensity">**maxDescriptionFeatureDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0.1</code> | In "auto" showLabels mode, hide descriptions when visible feature density (features/pixel) exceeds this value. Lower than maxLabelFeatureDensity so descriptions drop before names<br>_advanced_ |
| <span id="slot-color">**color**</span><br>[FeatureColor](../featurecolor) | The main fill of each feature: a CSS color or a jexl expression (`"goldenrod"`, `"jexl:…"`), or `{ field, domain, range }` to paint each value of a field in a `range` color, with a key. |
| <span id="slot-showoutline">**showOutline**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw an outline around each feature |
| <span id="slot-outlinecolor">**outlineColor**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | the outline's color while showOutline draws one; unset takes the theme's |
| <span id="slot-featureheight">**featureHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>10</code> | height in pixels of the main body of each feature in the normal display mode; compact draws it at 0.6 of this and superCompact at 0.3<br>_callback args:_ `feature` |
| <span id="slot-displaymode">**displayMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (normal, compact, superCompact, collapsed) = <code>'normal'</code> | Feature height preset, `normal` by default; `compact` and `superCompact` shrink the rows, and `collapsed` packs every feature onto a single row with all labels hidden |
| <span id="slot-facet">**facet**</span><br>[SectionFacet](../sectionfacet) | One labelled section of the track per value of a field: `"strand"`, or `{ field, domain }` with the order its sections stack in. |
| <span id="slot-labels">**labels**</span><br>[CanvasFeatureLabels sub-schema](#slot-labelsname) | The fields a feature's name label and description line read. |
| <span id="slot-labelsname">**labels.name**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>'jexl:get(feature,'name') &#124;&#124; get(feature,'id')'</code> | the field each feature's name label reads, such as `gene_name`, or a `jexl:` expression over `feature`; the default reads the name, else the ID, and an empty value draws no name |
| <span id="slot-labelsdescription">**labels.description**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'note') &#124;&#124; get(feature,'description') &#124;&#124; get(…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'note') &#124;&#124; get(feature,'description') &#124;&#124; get(feature,'function')'</code></pre></dialog></span> | the field each feature's description line reads, such as `note`, or a `jexl:` expression over `feature`; the default reads `note`, else `description`, else `function`, and an empty value draws no description |
| <span id="slot-heightmode">**heightMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (fixed, grow, fit) = <code>'fit'</code> | Track-sizing strategy — how the track responds when there are more features than fit (shared vocabulary with the alignments display, exposed in the "Track sizing" menu). `fit` (the default) keeps the track height and gives up descriptions, then isoforms, then names, then squeezes boxes down to 2px, and scrolls only what still overflows; `fixed` keeps a scrollable fixed height; `grow` expands the track to show all features. Orthogonal to the per-feature size set by `displayMode`, which fit never enlarges. |
| <span id="slot-growmaxheight">**growMaxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>800</code> | Ceiling in pixels for the "autogrow track height" sizing mode; a track with more content than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes<br>_advanced_ |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">2 slots</span> |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |

## Retired keys

An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.

<!-- prettier-ignore -->
| Key | On load |
| --- | --- |
| `maxDisplayedBpPerPx` | ignored |
| `jexlFilters` | moved into a current slot |
| `color1` | moved into a current slot |
| `color2` | moved into a current slot |
| `color3` | moved into a current slot |
| `outline` | moved into a current slot |
| `maxHeight` | ignored |
| `hideSourceFeatures` | ignored |
| `renderer` | moved into a current slot |
| `showDescriptions` | moved into a current slot |
