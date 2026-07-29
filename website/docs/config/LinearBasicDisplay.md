---
id: linearbasicdisplay
title: LinearBasicDisplay
sidebar_label: Display -> LinearBasicDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `canvas`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/configSchema.ts).

## Example usage

A complete `FeatureTrack` config (e.g. genes from a GFF3) to paste into
`tracks`. `displayMode` sets the feature height preset (`normal`, `compact`, or
`superCompact`), or `collapsed` for a single-row overview:

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

_See the **Config slots** section below for all available configuration fields._

configuration for the basic linear feature display (genes, BED, GFF, etc.)

Color slots are display-level: set them inside a track's `displays` array.
`color` is the main feature fill; use a plain CSS color, or a `jexl:` expression
to color per-feature. (`connectorColor` and `utrColor` set the intron lines and
UTR fill. The legacy `color1`/`color2`/`color3` names still work and map onto
these.)

```json
{
  "type": "FeatureTrack",
  "trackId": "my_genes",
  "name": "Genes",
  "assemblyNames": ["hg19"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "genes.gff.gz" },
  "displays": [
    {
      "type": "LinearBasicDisplay",
      "color": "blue",
      "utrColor": "lightblue"
    }
  ]
}
```

Color by an attribute with a jexl expression:

```json
{
  "type": "LinearBasicDisplay",
  "color": "jexl:get(feature,'type')=='gene'?'blue':'gray'"
}
```

## Related links

- **Adapter:** [BedAdapter](../bedadapter)
- **Adapter:** [BedTabixAdapter](../bedtabixadapter)
- **Adapter:** [BigBedAdapter](../bigbedadapter)
- **Adapter:** [FromConfigAdapter](../fromconfigadapter)
- **Adapter:** [Gff3Adapter](../gff3adapter)
- **Adapter:** [Gff3TabixAdapter](../gff3tabixadapter)
- **Adapter:** [GtfAdapter](../gtfadapter)
- **Adapter:** [GtfTabixAdapter](../gtftabixadapter)
- **State model:** [runtime API](../../models/linearbasicdisplay)
- **Base config:** [LinearCanvasBaseDisplay](../linearcanvasbasedisplay)

## Config slots

These slots go on a display entry:
`"displays": [{ "type": "LinearBasicDisplay", ... }]`, or in the track's
[`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this
is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained
in the [config slot types reference](/docs/config_guides/slot_types). Slots a
base configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description | From |
| --- | --- | --- |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>5_000_000</code> | Feature (GFF/BED) tracks are light text, and the tabix byte estimate is block-granular (a small region still pulls whole BGZF blocks), so a single gene can trip a tighter gate. A few Mb of feature text downloads fast; the feature-density gate remains the backstop for genuinely over-dense views. VcfTabixAdapter matches this 5 Mb for the same reason; the binary alignment adapters (CRAM 3 Mb) keep their own tighter limit.<br>_advanced_ |  |
| <span id="slot-maxheight">**maxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1200</code> | Clamp in pixels on the content height this display reports (does not limit fixed or fit mode, where taller content scrolls). The autogrow ceiling is growMaxHeight<br>_advanced_ | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-growmaxheight">**growMaxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>800</code> | Ceiling in pixels for the "autogrow track height" sizing mode; a track with more content than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes. Raising it past maxHeight has no effect, since that clamps the content height first<br>_advanced_ | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-heightmode">**heightMode**</span><br>`maybeStringEnum` (fixed, grow, fit) = <code>'fixed'</code> _promotable_ | Track-sizing strategy — how the track responds when there are more features than fit (shared vocabulary with the alignments display, exposed in the "Track sizing" menu). Unset (the default) follows the session-wide default for this display type, falling back to `fixed`; `fixed` keeps a scrollable fixed height, `grow` expands the track to show all features, `fit` squeezes features to fill the current height. Orthogonal to the per-feature size set by `displayMode`. Unifies the former `autoHeight` (grow) + `squeezeToDisplayHeight` (fit) settings. | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-showlabels">**showLabels**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, on, off) = <code>'auto'</code> | Show feature labels: "auto" hides labels at high feature density, "on" always shows, "off" always hides | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-maxlabelfeaturedensity">**maxLabelFeatureDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>MAX_LABEL_FEATURE_DENSITY</code> | In "auto" showLabels mode, hide labels when visible feature density (features/pixel) exceeds this value<br>_advanced_ | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-showdescriptions">**showDescriptions**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Show feature descriptions | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-color">**color**</span><br>`maybeColor` = <code>undefined</code> | the main fill color of each feature (a CSS color, or a jexl expression for per-feature coloring). Unset, a feature's own BED itemRgb paints it if it has one, else goldenrod<br>_callback args:_ `feature` | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-connectorcolor">**connectorColor**</span><br>`maybeColor` = <code>undefined</code> | color of the connecting/intron lines between feature segments (defaults to the theme text color)<br>_callback args:_ `feature` | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-utrcolor">**utrColor**</span><br>`maybeColor` = <code>undefined</code> | fill color for UTRs on gene/transcript glyphs. Unset, a feature's own BED itemRgb paints them too (matching UCSC's whole-item coloring), else a contrasting blue<br>_callback args:_ `feature` | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-outlinecolor">**outlineColor**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>''</code> | outline color for features (empty string = no outline) | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-featureheight">**featureHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>10</code> | height in pixels of the main body of each feature<br>_callback args:_ `feature` | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-displaymode">**displayMode**</span><br>`maybeStringEnum` (normal, compact, superCompact, collapsed) = <code>'normal'</code> _promotable_ | Feature height preset. Unset (the default) follows the session-wide default for this display type, falling back to `normal`; `normal`/`compact`/`superCompact` customize the track explicitly (including customizing `normal` back over a `compact` session default); `collapsed` packs every feature onto a single row with all labels hidden | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-geneglyphmode">**geneGlyphMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, all, longestCoding) = <code>'auto'</code> | Gene glyph display mode: "auto" switches based on zoom level, "all" shows all transcripts, "longestCoding" shows only the longest coding transcript | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-subfeaturelabels">**subfeatureLabels**</span><br>`maybeStringEnum` (none, below, overlay) = <code>'none'</code> _promotable_ | subfeature label display mode. Unset (the default) follows the session-wide default for this display type, falling back to `none`; `none`/`below`/`overlay` customize the track explicitly | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-displaydirectionalchevrons">**displayDirectionalChevrons**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#maybeboolean) = <code>true</code> _promotable_ | Display directional chevrons on intron lines to indicate strand direction. Unset (the default) follows the session-wide default for this display type, falling back to on; an explicit true/false customizes the track (including customizing on over an off session default) | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-transcripttypes">**transcriptTypes**</span><br>`stringArray` = <details><summary><code>[ 'mRNA', 'transcript', 'primary_transcript', 'V_gene_segment',…</code></summary><pre><code>[&#10;&#160;&#160;&#160;&#160;'mRNA',&#10;&#160;&#160;&#160;&#160;'transcript',&#10;&#160;&#160;&#160;&#160;'primary_transcript',&#10;&#160;&#160;&#160;&#160;'V_gene_segment',&#10;&#160;&#160;&#160;&#160;'C_gene_segment',&#10;&#160;&#160;&#160;&#160;'D_gene_segment',&#10;&#160;&#160;&#160;&#160;'J_gene_segment',&#10;&#160;&#160;]</code></pre></details> |  | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-containertypes">**containerTypes**</span><br>`stringArray` = <code>['proteoform_orf']</code> |  | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-subparts">**subParts**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'CDS,UTR,five_prime_UTR,three_prime_UTR'</code> | subparts for a glyph | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-impliedutrs">**impliedUTRs**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | imply UTRs from exon/CDS differences on transcript glyphs that carry no explicit UTR subfeatures | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-labelsname">**labels.name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'jexl:get(feature,'name') &#124;&#124; get(feature,'id')'</code> | the primary name of the feature to show<br>_callback args:_ `feature` | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-labelsdescription">**labels.description**</span><br>[`string`](/docs/config_guides/slot_types#string) = <details><summary><code>'jexl:get(feature,'note') &#124;&#124; get(feature,'description') &#124;&#124; get(…</code></summary><pre><code>'jexl:get(feature,'note') &#124;&#124; get(feature,'description') &#124;&#124; get(feature,'function')'</code></pre></details> | the text description to show<br>_callback args:_ `feature` | [LinearCanvasBaseDisplay](../linearcanvasbasedisplay) |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message, used if byte size estimates are not available<br>_advanced_ | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <details><summary><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></summary><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></details> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[`get(feature,'gbkey')!='Src'`]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config | [BaseLinearDisplay](../baselineardisplay) |
