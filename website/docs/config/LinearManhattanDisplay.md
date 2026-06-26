---
id: linearmanhattandisplay
title: LinearManhattanDisplay
sidebar_label: Display -> LinearManhattanDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/LinearManhattanDisplay/configSchemaFactory.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearManhattanDisplay.md)

## Example usage

Minimal `GWASTrack` config. See the
[GWAS track guide](/docs/config_guides/gwas_track) for all options:

```js
{
  type: 'GWASTrack',
  trackId: 'gwas',
  name: 'GWAS results',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GWASAdapter',
    uri: 'https://example.com/gwas.bed.gz',
  },
}
```

Taller track, LocusZoom-style coloring: `colorBy: 'ld'` colors each point by its
r² to the index SNP read from `ldAdapter`. The `displayDefaults` object
shorthand is equivalent to
`displays: [{ type: 'LinearManhattanDisplay', displayId: '...', ... }]` — see
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'GWASTrack',
  trackId: 'gwas',
  name: 'GWAS results',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GWASAdapter',
    uri: 'https://example.com/gwas.bed.gz',
  },
  displayDefaults: {
    height: 400,
    colorBy: 'ld',
    ldAdapter: {
      type: 'PlinkLDTabixAdapter',
      uri: 'https://example.com/plink.ld.gz',
    },
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

configuration for the Manhattan plot display used by GWAS tracks

<details open>
<summary>LinearManhattanDisplay - Slots</summary>

#### slot: color

```js
{
  type: 'color',
  defaultValue: '#0068d1',
  description: 'CSS color or jexl callback for Manhattan points',
}
```

#### slot: colorBy

LocusZoom-style coloring. 'normal' uses `color`; 'ld' colors each point by its
r² to the index SNP, read from `ldAdapter`.

```js
{
  type: 'stringEnum',
  model: types.enumeration('GwasColorBy', ['normal', 'ld']),
  defaultValue: 'normal',
  description: 'How to color Manhattan points',
}
```

#### slot: ldAdapter

PLINK .ld adapter (PlinkLDAdapter / PlinkLDTabixAdapter) supplying pairwise r²
used when colorBy is 'ld'.

```js
{
  type: 'frozen',
  defaultValue: null,
  description: 'Adapter config for PLINK .ld pairwise r² data',
}
```

</details>

### LinearManhattanDisplay - Derives from

```js
baseConfiguration: linearWiggleDisplayConfigSchema
```
