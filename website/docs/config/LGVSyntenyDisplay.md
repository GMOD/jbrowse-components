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
