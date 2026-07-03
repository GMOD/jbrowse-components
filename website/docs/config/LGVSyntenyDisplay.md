---
id: lgvsyntenydisplay
title: LGVSyntenyDisplay
sidebar_label: Display -> LGVSyntenyDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/configSchemaF.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LGVSyntenyDisplay.md)

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

_See the **Slots** section below for all available configuration fields._

## Overview

### LGVSyntenyDisplay - State model

This config's runtime API is documented on its
[state model page](../../models/lgvsyntenydisplay).

<details open>
<summary>LGVSyntenyDisplay - Slots</summary>

#### slot: colorBy

Synteny reads are strand-colored by default (vs the base alignments display's
`normal`); overrides the inherited `colorBy` slot's default.

**Type:** `frozen`

```js
{
  type: 'frozen',
  defaultValue: { type: 'strand' },
  description: 'Color scheme for synteny reads',
  advanced: true,
}
```

#### slot: showCoverage

Synteny reads hide the coverage histogram by default; overrides the inherited
base alignments display's `showCoverage` default of `true`.

**Type:** `boolean` · **Default:** `false`

```js
{
  type: 'boolean',
  defaultValue: false,
  description: 'Draw the coverage histogram band',
}
```

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

<details open>
<summary>Inherited from LinearAlignmentsDisplay</summary>

[LinearAlignmentsDisplay config →](../linearalignmentsdisplay)

#### slot: featureHeight

Height of each feature (read) in pixels

**Type:** `number` · **Default:** `7`

```js
{
  type: 'number',
  defaultValue: 7,
  description: 'Height of each feature (read) in pixels',
  promotable: true,
}
```

#### slot: featureSpacing

Spacing between features in pixels

**Type:** `number` · **Default:** `1`

```js
{
  type: 'number',
  defaultValue: 1,
  description: 'Spacing between features in pixels',
  promotable: true,
}
```

#### slot: readConnectionsLineWidth

Line width for read-connection arcs/lines in pixels

**Type:** `number` · **Default:** `1`

```js
{
  type: 'number',
  defaultValue: 1,
  description: 'Line width for read-connection arcs/lines in pixels',
}
```

#### slot: showSashimiLabels

Draw the supporting-read count on each sashimi arc

**Type:** `boolean` · **Default:** `false`

```js
{
  type: 'boolean',
  defaultValue: false,
  description: 'Draw the supporting-read count on each sashimi arc',
}
```

#### slot: maxHeight

Maximum pixel height of the pileup layout; reads beyond this are not stacked
(coverage still reflects true depth)

**Type:** `number` · **Default:** `6000`

```js
{
  type: 'number',
  defaultValue: 6000,
  description:
    'Maximum pixel height of the pileup layout; reads beyond this are not stacked (coverage still reflects true depth)',
  advanced: true,
}
```

#### slot: height

**Type:** `number` · **Default:** `250`

```js
{
  type: 'number',
  defaultValue: 250,
}
```

#### slot: colorBy

Color scheme for reads

**Type:** `frozen`

```js
{
  type: 'frozen',
  defaultValue: { type: 'normal' },
  description: 'Color scheme for reads',
  advanced: true,
}
```

#### slot: filterBy

default filter flags is exclude 1540 read unmapped (0x4) read fails
platform/vendor quality checks (0x200) read is PCR or optical duplicate (0x400)

**Type:** `frozen`

```js
{
  type: 'frozen',
  defaultValue: defaultFilterFlags,
  description: 'Filter settings for reads',
  advanced: true,
}
```

#### slot: groupBy

In-track stacked grouping, e.g. `{ type: "strand" }` to pre-group reads by
strand (null = ungrouped)

**Type:** `frozen`

```js
{
  type: 'frozen',
  defaultValue: null,
  description:
    'In-track stacked grouping, e.g. `{ type: "strand" }` to pre-group reads by strand (null = ungrouped)',
  advanced: true,
}
```

#### slot: autoscale

Coverage autoscale type

**Type:** `stringEnum` · **Default:** `'local'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('Coverage autoscale type', [
    'local',
    'localsd',
  ]),
  defaultValue: 'local',
  description: 'Coverage autoscale type',
}
```

#### slot: minScore

Minimum coverage depth bound

**Type:** `number`

```js
{
  type: 'number',
  defaultValue: Number.MIN_VALUE,
  description: 'Minimum coverage depth bound',
  advanced: true,
}
```

#### slot: maxScore

Maximum coverage depth bound

**Type:** `number`

```js
{
  type: 'number',
  defaultValue: Number.MAX_VALUE,
  description: 'Maximum coverage depth bound',
  advanced: true,
}
```

#### slot: scaleType

Coverage scale type (linear or log)

**Type:** `stringEnum` · **Default:** `'linear'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('Coverage scale type', ['linear', 'log']),
  defaultValue: 'linear',
  description: 'Coverage scale type (linear or log)',
}
```

#### slot: numStdDev

Number of standard deviations for localsd autoscale

**Type:** `number` · **Default:** `3`

```js
{
  type: 'number',
  defaultValue: 3,
  description: 'Number of standard deviations for localsd autoscale',
  advanced: true,
}
```

#### slot: mismatchAlpha

Fade mismatches by base quality

**Type:** `boolean` · **Default:** `false`

```js
{
  type: 'boolean',
  defaultValue: false,
  description: 'Fade mismatches by base quality',
}
```

#### slot: showLowFreqMismatches

Show low-frequency mismatches (below the SNP-calling threshold) in the coverage
track

**Type:** `boolean` · **Default:** `false`

```js
{
  type: 'boolean',
  defaultValue: false,
  description:
    'Show low-frequency mismatches (below the SNP-calling threshold) in the coverage track',
}
```

#### slot: showLegend

Show the color-scheme legend overlay

**Type:** `boolean` · **Default:** `false`

```js
{
  type: 'boolean',
  defaultValue: false,
  description: 'Show the color-scheme legend overlay',
}
```

#### slot: sortedBy

Sort reads at a genomic position, e.g. by base, strand, or a tag (null =
unsorted)

**Type:** `frozen`

```js
{
  type: 'frozen',
  defaultValue: null,
  description:
    'Sort reads at a genomic position, e.g. by base, strand, or a tag (null = unsorted)',
  advanced: true,
}
```

#### slot: showOutline

null = auto: outline is drawn only in chain/linked-read modes. Set true/false to
force it on or off regardless of mode.

**Type:** `frozen`

```js
{
  type: 'frozen',
  defaultValue: null,
  description: 'Draw an outline around each read (null = auto by mode)',
  advanced: true,
}
```

#### slot: linkedReads

Linked-read (barcode-chain) layout mode

**Type:** `stringEnum` · **Default:** `'off'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('LinkedReadsMode', ['off', 'normal']),
  defaultValue: 'off',
  description: 'Linked-read (barcode-chain) layout mode',
}
```

#### slot: showBezierConnections

Draw paired-read connection curves over the pileup

**Type:** `boolean` · **Default:** `false`

```js
{
  type: 'boolean',
  defaultValue: false,
  description: 'Draw paired-read connection curves over the pileup',
}
```

#### slot: showCoverage

Draw the coverage histogram band

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description: 'Draw the coverage histogram band',
}
```

#### slot: showPileup

Draw the stacked-read pileup band

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description: 'Draw the stacked-read pileup band',
}
```

#### slot: coverageHeight

Height of the coverage band in pixels

**Type:** `number` · **Default:** `45`

```js
{
  type: 'number',
  defaultValue: 45,
  description: 'Height of the coverage band in pixels',
}
```

#### slot: showMismatches

Draw per-base mismatches on reads

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description: 'Draw per-base mismatches on reads',
}
```

#### slot: showInterbaseIndicators

Draw interbase insertion/deletion indicators

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description: 'Draw interbase insertion/deletion indicators',
}
```

#### slot: drawSingletons

Draw reads whose mate is unmapped

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description: 'Draw reads whose mate is unmapped',
}
```

#### slot: drawProperPairs

Draw properly-paired reads

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description: 'Draw properly-paired reads',
}
```

#### slot: flipStrandLongReadChains

Flip strand coloring for reverse long-read chains

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description: 'Flip strand coloring for reverse long-read chains',
}
```

#### slot: colorSupplementaryChains

Paint paired supplementary chains a flat supplementary color

**Type:** `boolean` · **Default:** `false`

```js
{
  type: 'boolean',
  defaultValue: false,
  description:
    'Paint paired supplementary chains a flat supplementary color',
}
```

#### slot: drawInter

Draw inter-chromosomal read-connection arcs

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description: 'Draw inter-chromosomal read-connection arcs',
}
```

#### slot: drawLongRange

Draw long-range read-connection arcs

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description: 'Draw long-range read-connection arcs',
}
```

#### slot: arcColorByType

How to color read-connection arcs

**Type:** `stringEnum` · **Default:** `'insertSizeAndOrientation'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('ArcColorByType', [
    'insertSizeAndOrientation',
    'insertSize',
    'orientation',
  ]),
  defaultValue: 'insertSizeAndOrientation',
  description: 'How to color read-connection arcs',
}
```

#### slot: readConnections

Read-connection rendering mode (mate pairs + split reads)

**Type:** `stringEnum` · **Default:** `'off'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('ReadConnectionsMode', [
    'off',
    'arc',
    'samplot',
  ]),
  defaultValue: 'off',
  description:
    'Read-connection rendering mode (mate pairs + split reads)',
}
```

#### slot: readConnectionsDown

Draw read connections below the coverage band

**Type:** `boolean` · **Default:** `false`

```js
{
  type: 'boolean',
  defaultValue: false,
  description: 'Draw read connections below the coverage band',
}
```

#### slot: showSashimiArcs

Draw sashimi (splice-junction) arcs

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description: 'Draw sashimi (splice-junction) arcs',
}
```

#### slot: sashimiArcsMode

Sashimi junction-arc placement

**Type:** `stringEnum` · **Default:** `'up'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('SashimiArcsMode', ['up', 'down', 'auto']),
  defaultValue: 'up',
  description: 'Sashimi junction-arc placement',
}
```

#### slot: minSashimiScore

Hide sashimi arcs with fewer than this many supporting reads

**Type:** `number` · **Default:** `0`

```js
{
  type: 'number',
  defaultValue: 0,
  description:
    'Hide sashimi arcs with fewer than this many supporting reads',
}
```

#### slot: sashimiArcsHeight

Height of the sashimi-arc band in pixels

**Type:** `number` · **Default:** `40`

```js
{
  type: 'number',
  defaultValue: 40,
  description: 'Height of the sashimi-arc band in pixels',
}
```

#### slot: readConnectionsHeight

Height of the read-connection band in pixels

**Type:** `number` · **Default:** `40`

```js
{
  type: 'number',
  defaultValue: 40,
  description: 'Height of the read-connection band in pixels',
}
```

#### slot: showSoftClipping

Draw soft-clipped read portions

**Type:** `boolean` · **Default:** `false`

```js
{
  type: 'boolean',
  defaultValue: false,
  description: 'Draw soft-clipped read portions',
  promotable: true,
}
```

</details>

<details open>
<summary>Inherited from BaseLinearDisplay</summary>

[BaseLinearDisplay config →](../baselineardisplay)

#### slot: maxFeatureScreenDensity

maximum features per pixel before showing a "too many features" message, used if
byte size estimates are not available

**Type:** `number` · **Default:** `1`

```js
{
  type: 'number',
  description:
    'maximum features per pixel before showing a "too many features" message, used if byte size estimates are not available',
  defaultValue: 1,
  advanced: true,
}
```

#### slot: fetchSizeLimit

maximum data to attempt to download for a given track, used if adapter doesn't
specify one

**Type:** `number` · **Default:** `1_000_000`

```js
{
  type: 'number',
  defaultValue: 1_000_000,
  description:
    "maximum data to attempt to download for a given track, used if adapter doesn't specify one",
  advanced: true,
}
```

#### slot: height

default height for the track

**Type:** `number` · **Default:** `100`

```js
{
  type: 'number',
  defaultValue: 100,
  description: 'default height for the track',
}
```

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

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  description:
    'default set of jexl filters to apply to a track. note: these do not use the jexl prefix because they have a deferred evaluation system',
  defaultValue: [],
}
```

</details>

### LGVSyntenyDisplay - Derives from

- [LinearAlignmentsDisplay](../linearalignmentsdisplay)

```js
baseConfiguration: linearAlignmentsDisplayConfigSchemaFactory(pluginManager)
```
