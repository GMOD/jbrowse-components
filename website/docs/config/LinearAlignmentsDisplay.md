---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
sidebar_label: Display -> LinearAlignmentsDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `alignments`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts).

## Example usage

Minimal BAM track — no display override needed for defaults. See the
[alignments track guide](/docs/config_guides/alignments_track) for all adapter
and display options:

```js
{
  type: 'AlignmentsTrack',
  trackId: 'ngs_reads',
  name: 'NGS reads',
  assemblyNames: ['hg38'],
  adapter: { type: 'BamAdapter', uri: 'https://example.com/sample.bam' },
}
```

CRAM colored by CpG methylation (modBAM MM/ML tags). The `displayDefaults`
object shorthand applies settings without spelling out the display `type` or
`displayId` — equivalent to
`displays: [{ type: 'LinearAlignmentsDisplay', displayId: '...', colorBy: ... }]`.
See [configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'AlignmentsTrack',
  trackId: 'methylation',
  name: 'Methylation',
  assemblyNames: ['hg38'],
  adapter: { type: 'CramAdapter', uri: 'https://example.com/sample.cram' },
  displayDefaults: { colorBy: { type: 'methylation' } },
}
```

Long reads — taller track, soft-clipping shown, split/chimeric reads connected
by arcs:

```js
{
  type: 'AlignmentsTrack',
  trackId: 'long_reads',
  name: 'Long reads',
  assemblyNames: ['hg38'],
  adapter: { type: 'BamAdapter', uri: 'https://example.com/longreads.bam' },
  displayDefaults: {
    height: 400,
    showSoftClipping: true,
    linkedReads: 'normal',
    readConnections: 'arc',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

configuration schema for the LinearAlignmentsDisplay

| Slot                                                       | Type                                                             | Description                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [featureHeight](#slot-featureheight)                       | `number`                                                         | Height of each feature (read) in pixels                                                                                                                                                                                                                                                                                                                                                              |
| [featureSpacing](#slot-featurespacing)                     | `number`                                                         | Spacing between features in pixels                                                                                                                                                                                                                                                                                                                                                                   |
| [heightMode](#slot-heightmode)                             | `stringEnum`                                                     | Track-height strategy (shared vocabulary with the canvas feature display). `inherit` (the default) follows the session-wide default for this display type, falling back to `fixed`; `fixed` uses `featureHeight`/`featureSpacing` and scrolls; `grow` resizes the track to fit every read at the configured height; `fit` sizes reads so every uncollapsed group fills the display without scrolling |
| [readConnectionsLineWidth](#slot-readconnectionslinewidth) | `number`                                                         | Line width for read-connection arcs/lines in pixels                                                                                                                                                                                                                                                                                                                                                  |
| [showSashimiLabels](#slot-showsashimilabels)               | `boolean`                                                        | Draw the supporting-read count on each sashimi arc                                                                                                                                                                                                                                                                                                                                                   |
| [maxHeight](#slot-maxheight)                               | `number`                                                         | Maximum pixel height of the pileup layout; reads beyond this are not stacked (coverage still reflects true depth)                                                                                                                                                                                                                                                                                    |
| [height](#slot-height)                                     | `number`                                                         |                                                                                                                                                                                                                                                                                                                                                                                                      |
| [colorBy](#slot-colorby)                                   | `frozen`                                                         | Color scheme for reads                                                                                                                                                                                                                                                                                                                                                                               |
| [filterBy](#slot-filterby)                                 | `frozen`                                                         | default filter flags is exclude 1540 read unmapped (0x4) read fails platform/vendor quality checks (0x200) read is PCR or optical duplicate (0x400)                                                                                                                                                                                                                                                  |
| [groupBy](#slot-groupby)                                   | `frozen`                                                         | In-track stacked grouping, e.g. `{ type: "strand" }` to pre-group reads by strand (null = ungrouped)                                                                                                                                                                                                                                                                                                 |
| [autoscale](#slot-autoscale)                               | `stringEnum` (local, localsd)                                    | Coverage autoscale type                                                                                                                                                                                                                                                                                                                                                                              |
| [minScore](#slot-minscore)                                 | `number`                                                         | Minimum coverage depth bound                                                                                                                                                                                                                                                                                                                                                                         |
| [maxScore](#slot-maxscore)                                 | `number`                                                         | Maximum coverage depth bound                                                                                                                                                                                                                                                                                                                                                                         |
| [scaleType](#slot-scaletype)                               | `stringEnum` (linear, log)                                       | Coverage scale type (linear or log)                                                                                                                                                                                                                                                                                                                                                                  |
| [numStdDev](#slot-numstddev)                               | `number`                                                         | Number of standard deviations for localsd autoscale                                                                                                                                                                                                                                                                                                                                                  |
| [mismatchAlpha](#slot-mismatchalpha)                       | `maybeBoolean`                                                   | Fade mismatch bases by their per-base Phred quality. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false pins the track (either direction, including pinning off over an on session default)                                                                                                                                     |
| [showLowFreqMismatches](#slot-showlowfreqmismatches)       | `boolean`                                                        | Show low-frequency mismatches (below the SNP-calling threshold) in the coverage track                                                                                                                                                                                                                                                                                                                |
| [showLegend](#slot-showlegend)                             | `boolean`                                                        | Show the color-scheme legend overlay                                                                                                                                                                                                                                                                                                                                                                 |
| [sortedBy](#slot-sortedby)                                 | `frozen`                                                         | Sort reads at a genomic position, e.g. by base, strand, or a tag (null = unsorted)                                                                                                                                                                                                                                                                                                                   |
| [largeFeaturesFirst](#slot-largefeaturesfirst)             | `boolean`                                                        | Lay out the widest features in the lowest pileup rows instead of by genomic start, so large alignments cluster at the top rather than interleaving with small ones. Off by default; LGVSyntenyDisplay turns it on. Ignored while an explicit `sortedBy` position sort is active.                                                                                                                     |
| [showOutline](#slot-showoutline)                           | `frozen`                                                         | null = auto: outline is drawn only in chain/linked-read modes. Set true/false to force it on or off regardless of mode.                                                                                                                                                                                                                                                                              |
| [linkedReads](#slot-linkedreads)                           | `stringEnum` (inherit, off, normal)                              | Linked-read (barcode-chain) layout mode                                                                                                                                                                                                                                                                                                                                                              |
| [showBezierConnections](#slot-showbezierconnections)       | `boolean`                                                        | Draw paired-read connection curves over the pileup                                                                                                                                                                                                                                                                                                                                                   |
| [showCoverage](#slot-showcoverage)                         | `boolean`                                                        | Draw the coverage histogram band                                                                                                                                                                                                                                                                                                                                                                     |
| [showPileup](#slot-showpileup)                             | `boolean`                                                        | Draw the stacked-read pileup band                                                                                                                                                                                                                                                                                                                                                                    |
| [coverageHeight](#slot-coverageheight)                     | `number`                                                         | Height of the coverage band in pixels                                                                                                                                                                                                                                                                                                                                                                |
| [showMismatches](#slot-showmismatches)                     | `boolean`                                                        | Draw per-base mismatches on reads                                                                                                                                                                                                                                                                                                                                                                    |
| [showInterbaseIndicators](#slot-showinterbaseindicators)   | `boolean`                                                        | Draw interbase insertion/deletion indicators                                                                                                                                                                                                                                                                                                                                                         |
| [drawSingletons](#slot-drawsingletons)                     | `boolean`                                                        | Draw reads whose mate is unmapped                                                                                                                                                                                                                                                                                                                                                                    |
| [drawProperPairs](#slot-drawproperpairs)                   | `boolean`                                                        | Draw properly-paired reads                                                                                                                                                                                                                                                                                                                                                                           |
| [flipStrandLongReadChains](#slot-flipstrandlongreadchains) | `boolean`                                                        | Flip strand coloring for reverse long-read chains                                                                                                                                                                                                                                                                                                                                                    |
| [colorSupplementaryChains](#slot-colorsupplementarychains) | `boolean`                                                        | Paint paired supplementary chains a flat supplementary color                                                                                                                                                                                                                                                                                                                                         |
| [drawInter](#slot-drawinter)                               | `boolean`                                                        | Draw inter-chromosomal read-connection arcs                                                                                                                                                                                                                                                                                                                                                          |
| [drawLongRange](#slot-drawlongrange)                       | `boolean`                                                        | Draw long-range read-connection arcs                                                                                                                                                                                                                                                                                                                                                                 |
| [arcColorByType](#slot-arccolorbytype)                     | `stringEnum` (insertSizeAndOrientation, insertSize, orientation) | How to color read-connection arcs                                                                                                                                                                                                                                                                                                                                                                    |
| [readConnections](#slot-readconnections)                   | `stringEnum` (inherit, off, arc, samplot)                        | Read-connection rendering mode (mate pairs + split reads)                                                                                                                                                                                                                                                                                                                                            |
| [readConnectionsDown](#slot-readconnectionsdown)           | `boolean`                                                        | Draw read connections below the coverage band                                                                                                                                                                                                                                                                                                                                                        |
| [showSashimiArcs](#slot-showsashimiarcs)                   | `boolean`                                                        | Draw sashimi (splice-junction) arcs                                                                                                                                                                                                                                                                                                                                                                  |
| [sashimiArcsMode](#slot-sashimiarcsmode)                   | `stringEnum` (inherit, up, down, auto)                           | Sashimi junction-arc placement                                                                                                                                                                                                                                                                                                                                                                       |
| [minSashimiScore](#slot-minsashimiscore)                   | `number`                                                         | Hide sashimi arcs with fewer than this many supporting reads                                                                                                                                                                                                                                                                                                                                         |
| [sashimiArcsHeight](#slot-sashimiarcsheight)               | `number`                                                         | Height of the sashimi-arc band in pixels                                                                                                                                                                                                                                                                                                                                                             |
| [readConnectionsHeight](#slot-readconnectionsheight)       | `number`                                                         | Height of the read-connection band in pixels                                                                                                                                                                                                                                                                                                                                                         |
| [showSoftClipping](#slot-showsoftclipping)                 | `maybeBoolean`                                                   | Draw soft-clipped read portions. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false pins the track (either direction, including pinning off over an on session default)                                                                                                                                                         |

<details>
<summary>LinearAlignmentsDisplay - Slots</summary>

#### slot: featureHeight

Height of each feature (read) in pixels

**Type:** `number` · **Default:** `7` · _promotable_

#### slot: featureSpacing

Spacing between features in pixels

**Type:** `number` · **Default:** `1` · _promotable_

#### slot: heightMode

Track-height strategy (shared vocabulary with the canvas feature display).
`inherit` (the default) follows the session-wide default for this display type,
falling back to `fixed`; `fixed` uses `featureHeight`/`featureSpacing` and
scrolls; `grow` resizes the track to fit every read at the configured height;
`fit` sizes reads so every uncollapsed group fills the display without scrolling

**Type:** `stringEnum` · **Default:** `'inherit'` · _promotable_

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

**Type:** `number` · **Default:** `1`

#### slot: showSashimiLabels

Draw the supporting-read count on each sashimi arc

**Type:** `boolean` · **Default:** `false` · _promotable_

#### slot: maxHeight

Maximum pixel height of the pileup layout; reads beyond this are not stacked
(coverage still reflects true depth)

**Type:** `number` · **Default:** `6000` · _advanced_

#### slot: height

**Type:** `number` · **Default:** `250`

#### slot: colorBy

Color scheme for reads

**Type:** `frozen` · **Default:** `{ type: 'normal' }` · _advanced, promotable_

```js
{
  type: 'frozen',





  defaultValue: { type: 'normal' },
  promotable: true,





  validate: isRegisteredColorScheme,
  description: 'Color scheme for reads',
  advanced: true,
}
```

#### slot: filterBy

default filter flags is exclude 1540 read unmapped (0x4) read fails
platform/vendor quality checks (0x200) read is PCR or optical duplicate (0x400)

**Type:** `frozen` · **Default:** `defaultFilterFlags` · _advanced_

#### slot: groupBy

In-track stacked grouping, e.g. `{ type: "strand" }` to pre-group reads by
strand (null = ungrouped)

**Type:** `frozen` · **Default:** `null` · _advanced_

#### slot: autoscale

Coverage autoscale type

**Type:** `stringEnum` (one of `local`, `localsd`) · **Default:** `'local'`

#### slot: minScore

Minimum coverage depth bound

**Type:** `number` · **Default:** `Number.MIN_VALUE` · _advanced_

#### slot: maxScore

Maximum coverage depth bound

**Type:** `number` · **Default:** `Number.MAX_VALUE` · _advanced_

#### slot: scaleType

Coverage scale type (linear or log)

**Type:** `stringEnum` (one of `linear`, `log`) · **Default:** `'linear'`

#### slot: numStdDev

Number of standard deviations for localsd autoscale

**Type:** `number` · **Default:** `3` · _advanced_

#### slot: mismatchAlpha

Fade mismatch bases by their per-base Phred quality. Unset (the default) follows
the session-wide default for this display type, falling back to off; an explicit
true/false pins the track (either direction, including pinning off over an on
session default)

**Type:** `maybeBoolean` · **Default:** `undefined` · _promotable_

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

**Type:** `boolean` · **Default:** `false`

#### slot: showLegend

Show the color-scheme legend overlay

**Type:** `boolean` · **Default:** `false`

#### slot: sortedBy

Sort reads at a genomic position, e.g. by base, strand, or a tag (null =
unsorted)

**Type:** `frozen` · **Default:** `null` · _advanced_

#### slot: largeFeaturesFirst

Lay out the widest features in the lowest pileup rows instead of by genomic
start, so large alignments cluster at the top rather than interleaving with
small ones. Off by default; LGVSyntenyDisplay turns it on. Ignored while an
explicit `sortedBy` position sort is active.

**Type:** `boolean` · **Default:** `false`

#### slot: showOutline

null = auto: outline is drawn only in chain/linked-read modes. Set true/false to
force it on or off regardless of mode.

**Type:** `frozen` · **Default:** `null` · _advanced_

#### slot: linkedReads

Linked-read (barcode-chain) layout mode

**Type:** `stringEnum` (one of `inherit`, `off`, `normal`) · **Default:**
`'inherit'` · _promotable_

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

**Type:** `boolean` · **Default:** `false`

#### slot: showCoverage

Draw the coverage histogram band

**Type:** `boolean` · **Default:** `true`

#### slot: showPileup

Draw the stacked-read pileup band

**Type:** `boolean` · **Default:** `true`

#### slot: coverageHeight

Height of the coverage band in pixels

**Type:** `number` · **Default:** `45`

#### slot: showMismatches

Draw per-base mismatches on reads

**Type:** `boolean` · **Default:** `true`

#### slot: showInterbaseIndicators

Draw interbase insertion/deletion indicators

**Type:** `boolean` · **Default:** `true`

#### slot: drawSingletons

Draw reads whose mate is unmapped

**Type:** `boolean` · **Default:** `true`

#### slot: drawProperPairs

Draw properly-paired reads

**Type:** `boolean` · **Default:** `true`

#### slot: flipStrandLongReadChains

Flip strand coloring for reverse long-read chains

**Type:** `boolean` · **Default:** `true`

#### slot: colorSupplementaryChains

Paint paired supplementary chains a flat supplementary color

**Type:** `boolean` · **Default:** `false`

#### slot: drawInter

Draw inter-chromosomal read-connection arcs

**Type:** `boolean` · **Default:** `true`

#### slot: drawLongRange

Draw long-range read-connection arcs

**Type:** `boolean` · **Default:** `true`

#### slot: arcColorByType

How to color read-connection arcs

**Type:** `stringEnum` (one of `insertSizeAndOrientation`, `insertSize`,
`orientation`) · **Default:** `'insertSizeAndOrientation'`

#### slot: readConnections

Read-connection rendering mode (mate pairs + split reads)

**Type:** `stringEnum` (one of `inherit`, `off`, `arc`, `samplot`) ·
**Default:** `'inherit'` · _promotable_

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

**Type:** `boolean` · **Default:** `false` · _promotable_

#### slot: showSashimiArcs

Draw sashimi (splice-junction) arcs

**Type:** `boolean` · **Default:** `true`

#### slot: sashimiArcsMode

Sashimi junction-arc placement

**Type:** `stringEnum` (one of `inherit`, `up`, `down`, `auto`) · **Default:**
`'inherit'` · _promotable_

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

**Type:** `number` · **Default:** `0`

#### slot: sashimiArcsHeight

Height of the sashimi-arc band in pixels

**Type:** `number` · **Default:** `40`

#### slot: readConnectionsHeight

Height of the read-connection band in pixels

**Type:** `number` · **Default:** `40`

#### slot: showSoftClipping

Draw soft-clipped read portions. Unset (the default) follows the session-wide
default for this display type, falling back to off; an explicit true/false pins
the track (either direction, including pinning off over an on session default)

**Type:** `maybeBoolean` · **Default:** `undefined` · _promotable_

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

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details>
<summary>Inherited from BaseLinearDisplay</summary>

[BaseLinearDisplay config →](../baselineardisplay)

#### slot: maxFeatureScreenDensity

maximum features per pixel before showing a "too many features" message, used if
byte size estimates are not available

**Type:** `number` · **Default:** `1` · _advanced_

#### slot: fetchSizeLimit

maximum data to attempt to download for a given track, used if adapter doesn't
specify one

**Type:** `number` · **Default:** `1_000_000` · _advanced_

#### slot: mouseover

text to display when the cursor hovers over a feature

**Type:** `string` · **Default:**
`'jexl:mouseoverExtraInformation||get(feature,'_mouseOver')||get(feature,'name')||get(feature,'id')'`

```js
{
  type: 'string',
  description: 'text to display when the cursor hovers over a feature',
  defaultValue: `jexl:mouseoverExtraInformation||get(feature,'_mouseOver')||get(feature,'name')||get(feature,'id')`,
  contextVariable: ['feature', 'mouseoverExtraInformation'],
}
```

#### slot: jexlFilters

config jexlFilters are deferred evaluated so they are prepended with jexl at
runtime rather than being stored with jexl in the config

**Type:** `stringArray` · **Default:** `[]`

</details>

## Related links

- **Adapter:** [BamAdapter](../bamadapter)
- **Adapter:** [CramAdapter](../cramadapter)
- **Adapter:** [HtsgetBamAdapter](../htsgetbamadapter)
- **State model:** [runtime API](../../models/linearalignmentsdisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)
