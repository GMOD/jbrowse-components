---
id: linearbasicdisplay
title: LinearBasicDisplay
description: "Draws the genes and other features of a FeatureTrack, from a BED, GFF or similar file."
sidebar_label: Display -> LinearBasicDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/configSchema.ts).

Draws the genes and other features of a `FeatureTrack`, from a BED, GFF or
similar file. The display adds the gene-glyph slots (isoforms, UTRs,
chevrons) to the shared canvas base. `encoding.color` paints each
feature's fill and `utrs.encoding.color` its UTRs; the intron lines, chevrons and
strand arrows take the theme's stroke color.

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

## Color channels

<!-- prettier-ignore -->
| Setting | Page | `scale.type` | Preset fields |
| --- | --- | --- | --- |
| `encoding.color` | [](/docs/config/featurecolor#preset-fields) | ordinal, threshold, linear, log, identity | `strand`, `svType`, `impact`, `score` |

## Config slots

Display slots go on a display entry: `"displays": [{ "type": "LinearBasicDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>5000000</code> | Feature (GFF/BED) tracks are light text, and the tabix byte estimate is block-granular (a small region still pulls whole BGZF blocks), so a single gene can trip a tighter gate.<br>_advanced_ |
| <span id="slot-utrs">**utrs**</span><br>[FeatureUtrs](../featureutrs) | The UTR boxes, a [](/docs/config/featureutrs) object. Unset, a UTR takes its transcript's fill, a feature's own BED itemRgb included (matching UCSC's whole-item coloring), else a contrasting blue. |
| <span id="slot-geneglyphmode">**geneGlyphMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, all, representative) = <code>'auto'</code> | Gene glyph display mode: "auto" collapses each gene to one transcript when zoomed out and trims the rest to what the track height holds, "all" draws every transcript and scrolls the surplus instead of trimming, "representative" shows one transcript per gene — the first by `transcripts.sort`, else the longest coding |
| <span id="slot-labels">**labels**</span><br>[FeatureLabels sub-schema](#slot-labelsname) | The text drawn beside each feature: the base's name and description, and the names of its parts. |
| <span id="slot-labelsname">**labels.name**</span><br>[FeatureNameLabel](../featurenamelabel) | Each feature's name, a [](/docs/config/featurenamelabel) object. |
| <span id="slot-labelsdescription">**labels.description**</span><br>[FeatureDescriptionLabel](../featuredescriptionlabel) | The line under each name, a [](/docs/config/featuredescriptionlabel) object. |
| <span id="slot-labelssubfeatures">**labels.subfeatures**</span><br>[FeatureSubfeatureLabels](../featuresubfeaturelabels) | The names of a feature's parts, a [](/docs/config/featuresubfeaturelabels) object. |
| <span id="slot-chevrons">**chevrons**</span><br>[FeatureChevrons sub-schema](#slot-chevronsshow) | The arrows on a feature's intron lines. |
| <span id="slot-chevronsshow">**chevrons.show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw chevrons on intron lines pointing the way the feature reads |
| <span id="slot-transcripts">**transcripts**</span><br>[FeatureTranscripts](../featuretranscripts) | How a gene's isoforms are read and ranked, a [](/docs/config/featuretranscripts) object. |
| <span id="slot-containers">**containers**</span><br>[FeatureContainers](../featurecontainers) | The top-level types whose children stack on rows of their own, a [](/docs/config/featurecontainers) object. |
| <span class="slot-group">Inherited from [LinearCanvasBaseDisplay](../linearcanvasbasedisplay)</span> | <span class="slot-group-count">10 slots</span> |
| <span id="slot-filter">**filter**</span><br><code>fieldPredicateList()</code> | The features the display draws, a list of [](/docs/config/fieldpredicate) entries a feature must all pass: a field of the feature's own (`{ field: "score", gte: 100 }`), a `jexl:` expression that must hold (`"jexl:feature.type == 'gene'"`), or `geneLike`, true for every gene, transcript and RNA type, the `transcripts.types` and `containers.types`, and a top-level CDS. |
| <span id="slot-tooltip">**tooltip**</span><br>[FeatureTooltip](../featuretooltip) | The box hovering a feature opens, a [](/docs/config/featuretooltip) object. |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message<br>_advanced_ |
| <span id="slot-legend">**legend**</span><br>[Legend](../legend) | The display's color key, when it has one: the key an `encoding.color` field derives, or a variant track's consequence-impact / SV-type presets. |
| <span id="slot-encoding">**encoding**</span><br>[FeatureEncoding](../featureencoding) | The channels the features paint through: `encoding.color`, each feature's main fill. |
| <span id="slot-mark">**mark**</span><br>[FeatureMark](../featuremark) | The box each feature draws as, a [](/docs/config/featuremark) object: `{ height: 6 }`. |
| <span id="slot-displaymode">**displayMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (normal, compact, superCompact, collapsed) = <code>'normal'</code> | Feature height preset, `normal` by default; `compact` and `superCompact` shrink the rows, and `collapsed` packs every feature onto a single row with all labels hidden |
| <span id="slot-facet">**facet**</span><br>[SectionFacet](../sectionfacet) | One labelled section of the track per value of a field: `"strand"`, or `{ field, sort }` with the order its sections stack in. |
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
| `mouseover` | moved into a current slot |
| `jexlFilters` | moved into a current slot |
| `color1` | moved into a current slot |
| `color2` | ignored |
| `color3` | moved into a current slot |
| `featureHeight` | moved into a current slot |
| `transcriptTypes` | moved into a current slot |
| `containerTypes` | moved into a current slot |
| `showLabels` | moved into a current slot |
| `showDescriptions` | moved into a current slot |
| `subfeatureLabels` | moved into a current slot |
| `outline` | ignored |
| `maxHeight` | ignored |
| `impliedUTRs` | ignored |
| `renderer` | moved into a current slot |
| `color` | moved into a current slot |
