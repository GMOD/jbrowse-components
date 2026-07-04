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

### LinearAlignmentsDisplay - Compatible adapters

Data adapters that can supply the [AlignmentsTrack](../alignmentstrack):

- [BamAdapter](../bamadapter)
- [CramAdapter](../cramadapter)
- [HtsgetBamAdapter](../htsgetbamadapter)

### LinearAlignmentsDisplay - State model

This config's runtime API is documented on its
[state model page](../../models/linearalignmentsdisplay).

<details open>
<summary>LinearAlignmentsDisplay - Slots</summary>

#### slot: featureHeight

Height of each feature (read) in pixels

**Type:** `number` · **Default:** `7` · _promotable_

#### slot: featureSpacing

Spacing between features in pixels

**Type:** `number` · **Default:** `1` · _promotable_

#### slot: readConnectionsLineWidth

Line width for read-connection arcs/lines in pixels

**Type:** `number` · **Default:** `1`

#### slot: showSashimiLabels

Draw the supporting-read count on each sashimi arc

**Type:** `boolean` · **Default:** `false`

#### slot: maxHeight

Maximum pixel height of the pileup layout; reads beyond this are not stacked
(coverage still reflects true depth)

**Type:** `number` · **Default:** `6000` · _advanced_

#### slot: height

**Type:** `number` · **Default:** `250`

#### slot: colorBy

Color scheme for reads

**Type:** `frozen` · **Default:** `{ type: 'inherit' }` · _advanced, promotable_

```js
{
  type: 'frozen',







  defaultValue: { type: 'inherit' },
  promotedBase: { type: 'normal' },
  promotable: true,
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

Fade mismatches by base quality

**Type:** `boolean` · **Default:** `false`

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

#### slot: showOutline

null = auto: outline is drawn only in chain/linked-read modes. Set true/false to
force it on or off regardless of mode.

**Type:** `frozen` · **Default:** `null` · _advanced_

#### slot: linkedReads

Linked-read (barcode-chain) layout mode

**Type:** `stringEnum` (one of `off`, `normal`) · **Default:** `'off'`

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

**Type:** `stringEnum` (one of `off`, `arc`, `samplot`) · **Default:** `'off'`

#### slot: readConnectionsDown

Draw read connections below the coverage band

**Type:** `boolean` · **Default:** `false`

#### slot: showSashimiArcs

Draw sashimi (splice-junction) arcs

**Type:** `boolean` · **Default:** `true`

#### slot: sashimiArcsMode

Sashimi junction-arc placement

**Type:** `stringEnum` (one of `up`, `down`, `auto`) · **Default:** `'up'`

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

Draw soft-clipped read portions

**Type:** `boolean` · **Default:** `false` · _promotable_

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

<details open>
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

#### slot: height

default height for the track

**Type:** `number` · **Default:** `100`

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

### LinearAlignmentsDisplay - Derives from

- [BaseLinearDisplay](../baselineardisplay)
