---
id: lgvsyntenydisplay
title: LGVSyntenyDisplay
sidebar_label: Display -> LGVSyntenyDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`linear-comparative-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/configSchemaF.ts).

## Example usage

Shows a `SyntenyTrack`'s alignments in a plain linear view (rather than the
two-row synteny view). Same track config as a synteny track — just pick this
display type:

```js
{
  type: 'SyntenyTrack',
  trackId: 'hg38_vs_mm10',
  name: 'hg38 vs mm10',
  assemblyNames: ['hg38', 'mm10'],
  adapter: {
    type: 'PAFAdapter',
    uri: 'https://example.com/hg38_vs_mm10.paf',
    queryAssembly: 'hg38',
    targetAssembly: 'mm10',
  },
  displays: [
    {
      type: 'LGVSyntenyDisplay',
      displayId: 'hg38_vs_mm10-LGVSyntenyDisplay',
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Adapter:** [AllVsAllIndexedPAFAdapter](../allvsallindexedpafadapter)
- **Adapter:** [AllVsAllPAFAdapter](../allvsallpafadapter)
- **Adapter:** [ChainAdapter](../chainadapter)
- **Adapter:** [DeltaAdapter](../deltaadapter)
- **Adapter:** [MCScanAnchorsAdapter](../mcscananchorsadapter)
- **Adapter:** [MCScanBlocksAdapter](../mcscanblocksadapter)
- **Adapter:** [MCScanSimpleAnchorsAdapter](../mcscansimpleanchorsadapter)
- **Adapter:** [MashMapAdapter](../mashmapadapter)
- **Adapter:** [PAFAdapter](../pafadapter)
- **Adapter:** [PairwiseIndexedPAFAdapter](../pairwiseindexedpafadapter)
- **State model:** [runtime API](../../models/lgvsyntenydisplay)
- **Base config:** [LinearAlignmentsDisplay](../linearalignmentsdisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                           | Type      | Description                                                                                                                                                                                                 |
| ---------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [showCoverage](#slot-showcoverage)             | `boolean` | Synteny reads hide the coverage histogram by default; overrides the inherited base alignments display's `showCoverage` default of `true`.                                                                   |
| [largeFeaturesFirst](#slot-largefeaturesfirst) | `boolean` | Synteny lays large alignments out first so big syntenic blocks cluster at the top instead of interleaving with small ones; overrides the base alignments display's `largeFeaturesFirst` default of `false`. |

<details>
<summary>Advanced slots (1)</summary>

| Slot                     | Type     | Description                                                                                                                                |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [colorBy](#slot-colorby) | `frozen` | Synteny reads are strand-colored by default (vs the base alignments display's `normal`); overrides the inherited `colorBy` slot's default. |

</details>

<details>
<summary>LGVSyntenyDisplay - Slots</summary>

#### slot: colorBy

Synteny reads are strand-colored by default (vs the base alignments display's
`normal`); overrides the inherited `colorBy` slot's default.

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:**
`{ type: 'strand' }` · _advanced_

#### slot: showCoverage

Synteny reads hide the coverage histogram by default; overrides the inherited
base alignments display's `showCoverage` default of `true`.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

#### slot: largeFeaturesFirst

Synteny lays large alignments out first so big syntenic blocks cluster at the
top instead of interleaving with small ones; overrides the base alignments
display's `largeFeaturesFirst` default of `false`.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details>
<summary>Inherited from LinearAlignmentsDisplay</summary>

[LinearAlignmentsDisplay config →](../linearalignmentsdisplay)

#### slot: featureHeight

Height of each feature (read) in pixels

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `7` ·
_promotable_

#### slot: featureSpacing

Spacing between features in pixels

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `1` ·
_promotable_

#### slot: heightMode

Track-height strategy (shared vocabulary with the canvas feature display).
`inherit` (the default) follows the session-wide default for this display type,
falling back to `fixed`; `fixed` uses `featureHeight`/`featureSpacing` and
scrolls; `grow` resizes the track to fit every read at the configured height;
`fit` sizes reads so every uncollapsed group fills the display without scrolling

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) ·
**Default:** `'inherit'` · _promotable_

```js
{
  type: 'stringEnum',
  model: types.enumeration('heightMode', [...HEIGHT_MODE_VALUES]),
  description:
    'Track-height strategy (shared vocabulary with the canvas feature display). `inherit` (the default) follows the session-wide default for this display type, falling back to `fixed`; `fixed` uses `featureHeight`/`featureSpacing` and scrolls; `grow` resizes the track to fit every read at the configured height; `fit` sizes reads so every uncollapsed group fills the display without scrolling',




  defaultValue: 'inherit',
  promotedBase: 'fixed',
  promotable: true,
}
```

#### slot: readConnectionsLineWidth

Line width for read-connection arcs/lines in pixels

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `1`

#### slot: showSashimiLabels

Draw the supporting-read count on each sashimi arc

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false` · _promotable_

#### slot: maxHeight

Maximum pixel height of the pileup layout; reads beyond this are not stacked
(coverage still reflects true depth)

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`6000` · _advanced_

#### slot: height

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `250`

#### slot: filterBy

default filter flags is exclude 1540 read unmapped (0x4) read fails
platform/vendor quality checks (0x200) read is PCR or optical duplicate (0x400)

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:**
`defaultFilterFlags` · _advanced_

#### slot: groupBy

In-track stacked grouping, e.g. `{ type: "strand" }` to pre-group reads by
strand (null = ungrouped)

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:**
`null` · _advanced_

#### slot: autoscale

Coverage autoscale type

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`local`, `localsd`) · **Default:** `'local'`

#### slot: minScore

Minimum coverage depth bound

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`Number.MIN_VALUE` · _advanced_

#### slot: maxScore

Maximum coverage depth bound

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`Number.MAX_VALUE` · _advanced_

#### slot: scaleType

Coverage scale type (linear or log)

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`linear`, `log`) · **Default:** `'linear'`

#### slot: numStdDev

Number of standard deviations for localsd autoscale

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `3` ·
_advanced_

#### slot: mismatchAlpha

Fade mismatch bases by their per-base Phred quality. Unset (the default) follows
the session-wide default for this display type, falling back to off; an explicit
true/false pins the track (either direction, including pinning off over an on
session default)

**Type:** [`maybeBoolean`](/docs/config_guides/slot_types#maybeboolean) ·
**Default:** `undefined` · _promotable_

```js
{
  type: 'maybeBoolean',
  description:
    'Fade mismatch bases by their per-base Phred quality. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false pins the track (either direction, including pinning off over an on session default)',





  defaultValue: undefined,
  promotedBase: false,
  promotable: true,
}
```

#### slot: showLowFreqMismatches

Show low-frequency mismatches (below the SNP-calling threshold) in the coverage
track

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

#### slot: showLegend

Show the color-scheme legend overlay

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

#### slot: sortedBy

Sort reads at a genomic position, e.g. by base, strand, or a tag (null =
unsorted)

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:**
`null` · _advanced_

#### slot: showOutline

null = auto: outline is drawn only in chain/linked-read modes. Set true/false to
force it on or off regardless of mode.

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:**
`null` · _advanced_

#### slot: linkedReads

Linked-read (barcode-chain) layout mode

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`inherit`, `off`, `normal`) · **Default:** `'inherit'` · _promotable_

```js
{
  type: 'stringEnum',
  model: types.enumeration('LinkedReadsMode', [
    'inherit',
    'off',
    'normal',
  ]),





  defaultValue: 'inherit',
  promotedBase: 'off',
  promotable: true,
  description: 'Linked-read (barcode-chain) layout mode',
}
```

#### slot: showBezierConnections

Draw paired-read connection curves over the pileup

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

#### slot: showPileup

Draw the stacked-read pileup band

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: coverageHeight

Height of the coverage band in pixels

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `45`

#### slot: showMismatches

Draw per-base mismatches on reads

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: showInterbaseIndicators

Draw interbase insertion/deletion indicators

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: drawSingletons

Draw reads whose mate is unmapped

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: drawProperPairs

Draw properly-paired reads

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: flipStrandLongReadChains

Flip strand coloring for reverse long-read chains

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: colorSupplementaryChains

Paint paired supplementary chains a flat supplementary color

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

#### slot: drawInter

Draw inter-chromosomal read-connection arcs

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: drawLongRange

Draw long-range read-connection arcs

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: arcColorByType

How to color read-connection arcs

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`insertSizeAndOrientation`, `insertSize`, `orientation`) · **Default:**
`'insertSizeAndOrientation'`

#### slot: readConnections

Read-connection rendering mode (mate pairs + split reads)

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`inherit`, `off`, `arc`, `samplot`) · **Default:** `'inherit'` · _promotable_

```js
{
  type: 'stringEnum',
  model: types.enumeration('ReadConnectionsMode', [
    'inherit',
    'off',
    'arc',
    'samplot',
  ]),



  defaultValue: 'inherit',
  promotedBase: 'off',
  promotable: true,
  description:
    'Read-connection rendering mode (mate pairs + split reads)',
}
```

#### slot: readConnectionsDown

Draw read connections below the coverage band

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false` · _promotable_

#### slot: showSashimiArcs

Draw sashimi (splice-junction) arcs

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: sashimiArcsMode

Sashimi junction-arc placement

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`inherit`, `up`, `down`, `auto`) · **Default:** `'inherit'` · _promotable_

```js
{
  type: 'stringEnum',
  model: types.enumeration('SashimiArcsMode', [
    'inherit',
    'up',
    'down',
    'auto',
  ]),



  defaultValue: 'inherit',
  promotedBase: 'up',
  promotable: true,
  description: 'Sashimi junction-arc placement',
}
```

#### slot: minSashimiScore

Hide sashimi arcs with fewer than this many supporting reads

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `0`

#### slot: sashimiArcsHeight

Height of the sashimi-arc band in pixels

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `40`

#### slot: readConnectionsHeight

Height of the read-connection band in pixels

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `40`

#### slot: showSoftClipping

Draw soft-clipped read portions. Unset (the default) follows the session-wide
default for this display type, falling back to off; an explicit true/false pins
the track (either direction, including pinning off over an on session default)

**Type:** [`maybeBoolean`](/docs/config_guides/slot_types#maybeboolean) ·
**Default:** `undefined` · _promotable_

```js
{
  type: 'maybeBoolean',
  description:
    'Draw soft-clipped read portions. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false pins the track (either direction, including pinning off over an on session default)',





  defaultValue: undefined,
  promotedBase: false,
  promotable: true,
}
```

</details>

<details>
<summary>Inherited from BaseLinearDisplay</summary>

[BaseLinearDisplay config →](../baselineardisplay)

#### slot: maxFeatureScreenDensity

maximum features per pixel before showing a "too many features" message, used if
byte size estimates are not available

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `1` ·
_advanced_

#### slot: fetchSizeLimit

maximum data to attempt to download for a given track, used if adapter doesn't
specify one

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`1_000_000` · _advanced_

#### slot: mouseover

text to display when the cursor hovers over a feature

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'jexl:get(feature,'_mouseOver')||get(feature,'name')||get(feature,'id')'`

```js
{
  type: 'string',
  description: 'text to display when the cursor hovers over a feature',
  defaultValue: `jexl:get(feature,'_mouseOver')||get(feature,'name')||get(feature,'id')`,
  contextVariable: ['feature'],
}
```

#### slot: jexlFilters

config jexlFilters are deferred evaluated so they are prepended with jexl at
runtime rather than being stored with jexl in the config

**Type:** `stringArray` · **Default:** `[]`

</details>
