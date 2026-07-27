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

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

<details>
<summary>Advanced slots (1)</summary>

| Slot                                   | Type     | Description                                                                                                                                                                      |
| -------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [fetchSizeLimit](#slot-fetchsizelimit) | `number` | Feature (GFF/BED) tracks are light text, and the tabix byte estimate is block-granular (a small region still pulls whole BGZF blocks), so a single gene can trip a tighter gate. |

</details>

<details>
<summary>LinearBasicDisplay - Slots</summary>

#### slot: fetchSizeLimit

Feature (GFF/BED) tracks are light text, and the tabix byte estimate is
block-granular (a small region still pulls whole BGZF blocks), so a single gene
can trip a tighter gate. A few Mb of feature text downloads fast; the
feature-density gate remains the backstop for genuinely over-dense views.
VcfTabixAdapter matches this 5 Mb for the same reason; the binary alignment
adapters (CRAM 3 Mb) keep their own tighter limit.

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`5_000_000` · _advanced_

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details>
<summary>Inherited from LinearCanvasBaseDisplay</summary>

[LinearCanvasBaseDisplay config →](../linearcanvasbasedisplay)

#### slot: maxHeight

Clamp in pixels on the content height this display reports (does not limit fixed
or fit mode, where taller content scrolls). The autogrow ceiling is
growMaxHeight

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`1200` · _advanced_

#### slot: growMaxHeight

Ceiling in pixels for the "autogrow track height" sizing mode; a track with more
content than this grows to the ceiling and scrolls the rest. Does not apply to
the fixed or fit modes. Raising it past maxHeight has no effect, since that
clamps the content height first

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `800`
· _advanced_

#### slot: heightMode

Track-sizing strategy — how the track responds when there are more features than
fit (shared vocabulary with the alignments display, exposed in the "Track
sizing" menu). Unset (the default) follows the session-wide default for this
display type, falling back to `fixed`; `fixed` keeps a scrollable fixed height,
`grow` expands the track to show all features, `fit` squeezes features to fill
the current height. Orthogonal to the per-feature size set by `displayMode`.
Unifies the former `autoHeight` (grow) + `squeezeToDisplayHeight` (fit)
settings.

**Type:** `maybeStringEnum` (one of `fixed`, `grow`, `fit`) · **Default:**
`undefined` · **Resolves to:** `'fixed'` · _promotable_

#### slot: showLabels

Show feature labels: "auto" hides labels at high feature density, "on" always
shows, "off" always hides

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`auto`, `on`, `off`) · **Default:** `'auto'`

#### slot: maxLabelFeatureDensity

In "auto" showLabels mode, hide labels when visible feature density
(features/pixel) exceeds this value

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`MAX_LABEL_FEATURE_DENSITY` · _advanced_

#### slot: showDescriptions

Show feature descriptions

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: color

the main fill color of each feature (a CSS color, or a jexl expression for
per-feature coloring). Unset, a feature's own BED itemRgb paints it if it has
one, else goldenrod

**Type:** `maybeColor` · **Default:** `undefined` · **Callback args:** `feature`

#### slot: connectorColor

color of the connecting/intron lines between feature segments (defaults to the
theme text color)

**Type:** `maybeColor` · **Default:** `undefined` · **Callback args:** `feature`

#### slot: utrColor

fill color for UTRs on gene/transcript glyphs. Unset, a feature's own BED
itemRgb paints them too (matching UCSC's whole-item coloring), else a
contrasting blue

**Type:** `maybeColor` · **Default:** `undefined` · **Callback args:** `feature`

#### slot: outlineColor

outline color for features (empty string = no outline)

**Type:** [`color`](/docs/config_guides/slot_types#color) · **Default:** `''`

#### slot: featureHeight

height in pixels of the main body of each feature

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `10`
· **Callback args:** `feature`

#### slot: displayMode

Feature height preset. Unset (the default) follows the session-wide default for
this display type, falling back to `normal`; `normal`/`compact`/`superCompact`
customize the track explicitly (including customizing `normal` back over a
`compact` session default); `collapsed` packs every feature onto a single row
with all labels hidden

**Type:** `maybeStringEnum` (one of `normal`, `compact`, `superCompact`,
`collapsed`) · **Default:** `undefined` · **Resolves to:** `'normal'` ·
_promotable_

#### slot: geneGlyphMode

Gene glyph display mode: "auto" switches based on zoom level, "all" shows all
transcripts, "longestCoding" shows only the longest coding transcript

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`auto`, `all`, `longestCoding`) · **Default:** `'auto'`

#### slot: subfeatureLabels

subfeature label display mode. Unset (the default) follows the session-wide
default for this display type, falling back to `none`; `none`/`below`/`overlay`
customize the track explicitly

**Type:** `maybeStringEnum` (one of `none`, `below`, `overlay`) · **Default:**
`undefined` · **Resolves to:** `'none'` · _promotable_

#### slot: displayDirectionalChevrons

Display directional chevrons on intron lines to indicate strand direction. Unset
(the default) follows the session-wide default for this display type, falling
back to on; an explicit true/false customizes the track (including customizing
on over an off session default)

**Type:** [`maybeBoolean`](/docs/config_guides/slot_types#maybeboolean) ·
**Default:** `undefined` · **Resolves to:** `true` · _promotable_

#### slot: transcriptTypes

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  defaultValue: [
    'mRNA',
    'transcript',
    'primary_transcript',
    'V_gene_segment',
    'C_gene_segment',
    'D_gene_segment',
    'J_gene_segment',
  ],
}
```

#### slot: containerTypes

**Type:** `stringArray` · **Default:** `['proteoform_orf']`

#### slot: subParts

subparts for a glyph

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'CDS,UTR,five_prime_UTR,three_prime_UTR'`

#### slot: impliedUTRs

imply UTRs from exon/CDS differences on transcript glyphs that carry no explicit
UTR subfeatures

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: labels

```js
ConfigurationSchema('CanvasFeatureLabels', {
  name: {
    type: 'string',
    description: 'the primary name of the feature to show',
    defaultValue: `jexl:get(feature,'name') || get(feature,'id')`,
    contextVariable: ['feature'],
  },
  description: {
    type: 'string',
    description: 'the text description to show',
    defaultValue: `jexl:get(feature,'note') || get(feature,'description') || get(feature,'function')`,
    contextVariable: ['feature'],
  },
})
```

#### slot: labels.name

the primary name of the feature to show

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'jexl:get(feature,'name') || get(feature,'id')'` · **Callback args:** `feature`

#### slot: labels.description

the text description to show

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'jexl:get(feature,'note') || get(feature,'description') || get(feature,'function')'`
· **Callback args:** `feature`

</details>

<details>
<summary>Inherited from BaseLinearDisplay</summary>

[BaseLinearDisplay config →](../baselineardisplay)

#### slot: maxFeatureScreenDensity

maximum features per pixel before showing a "too many features" message, used if
byte size estimates are not available

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `1` ·
_advanced_

#### slot: forceLoad

Declarative equivalent of the "Force load" button on the "too much data" banner:
when true the display always renders, however large the region or dense the
features. Off by default (the gate guards against huge downloads). Set it on a
view no one can interact with — an embedded / notebook view, or a screenshot —
where the region is known and you want it drawn without a click.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false` · _advanced_

#### slot: height

default height for the track

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `100`

#### slot: mouseover

text to display when the cursor hovers over a feature

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'jexl:get(feature,'_mouseOver')||get(feature,'name')||get(feature,'function')||get(feature,'id')'`
· **Callback args:** `feature`

#### slot: jexlFilters

config jexlFilters are deferred evaluated so they are prepended with jexl at
runtime rather than being stored with jexl in the config

**Type:** `stringArray` · **Default:** `[`get(feature,'gbkey')!='Src'`]`

</details>
