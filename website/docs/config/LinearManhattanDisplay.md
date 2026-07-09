---
id: linearmanhattandisplay
title: LinearManhattanDisplay
sidebar_label: Display -> LinearManhattanDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gwas` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/LinearManhattanDisplay/configSchemaFactory.ts).

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
r² to the index SNP read from `ldAdapter`. `ldAdapter` is a slot on
`LinearManhattanDisplay` itself (not `GWASAdapter`), so it belongs in
`displayDefaults` like any other display slot. The `displayDefaults` object
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

_See the **Config slots** section below for all available configuration fields._

configuration for the Manhattan plot display used by GWAS tracks

## Related links

- **State model:** [runtime API](../../models/linearmanhattandisplay)
- **Base config:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                       | Type                      | Description                                                                                               |
| ------------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| [color](#slot-color)                       | `color`                   | CSS color or jexl callback for Manhattan points                                                           |
| [colorBy](#slot-colorby)                   | `stringEnum` (normal, ld) | LocusZoom-style coloring.                                                                                 |
| [scatterPointSize](#slot-scatterpointsize) | `number`                  | Manhattan point diameter in px (adjustable from the track menu).                                          |
| [ldAdapter](#slot-ldadapter)               | `frozen`                  | PLINK .ld adapter (PlinkLDAdapter / PlinkLDTabixAdapter) supplying pairwise r² used when colorBy is 'ld'. |

<details>
<summary>LinearManhattanDisplay - Slots</summary>

#### slot: color

CSS color or jexl callback for Manhattan points

**Type:** [`color`](/docs/config_guides/slot_types#color) · **Default:**
`'#0068d1'`

#### slot: colorBy

LocusZoom-style coloring. 'normal' uses `color`; 'ld' colors each point by its
r² to the index SNP, read from `ldAdapter`.

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`normal`, `ld`) · **Default:** `'normal'`

#### slot: scatterPointSize

Manhattan point diameter in px (adjustable from the track menu). Larger default
than wiggle's since Manhattan points are the primary glyph.

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `4`

#### slot: ldAdapter

PLINK .ld adapter (PlinkLDAdapter / PlinkLDTabixAdapter) supplying pairwise r²
used when colorBy is 'ld'.

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:**
`null`

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details>
<summary>Inherited from LinearWiggleDisplay</summary>

[LinearWiggleDisplay config →](../linearwiggledisplay)

#### slot: defaultRendering

Default rendering type: `xyplot`, `density`, `line`, or `scatter`.

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) ·
**Default:** `'xyplot'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('Rendering type', [...WIGGLE_RENDERING_TYPES]),
  defaultValue: 'xyplot',
  description: 'Default rendering type',
}
```

**Example:**

```json
{
  "type": "LinearWiggleDisplay",
  "defaultRendering": "density"
}
```

#### slot: height

Default height of the track

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `100`

#### slot: useBicolor

When true (the default), positive scores use posColor and negative scores use
negColor. When false, all bars use the single color slot.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: minimalTicks

Draw only the min/max Y-axis ticks

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false` · _advanced_

#### slot: summaryScoreMode

choose whether to use max/min/average or whiskers which combines all three into
the same rendering

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`max`, `min`, `avg`, `whiskers`) · **Default:** `'whiskers'`

</details>
