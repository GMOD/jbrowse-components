---
id: linearwiggledisplay
title: LinearWiggleDisplay
sidebar_label: Display -> LinearWiggleDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `wiggle`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts).

## Example usage

Minimal `QuantitativeTrack` config. See the
[quantitative track guide](/docs/config_guides/quantitative_track) for all
adapter and display options:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'coverage',
  name: 'Coverage',
  assemblyNames: ['hg38'],
  adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
}
```

Taller track, log scale, custom color:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'coverage',
  name: 'Coverage',
  assemblyNames: ['hg38'],
  adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
  displayDefaults: {
    height: 200,
    scaleType: 'log',
    color: 'darkgreen',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

configuration for the wiggle (quantitative/numeric) display showing XY plot,
density, line, or scatter renderings

These are display-level slots: set them inside a track's `displays` to change
its defaults (setting them at the track top level has no effect). The object
shorthand `displayDefaults: { key: value }` is equivalent to the full
`displays: [{ type: 'LinearWiggleDisplay', displayId: '...', key: value }]`
array form — see
[configuring displays](/docs/config_guides/tracks#configuring-displays).

## Related links

- **Adapter:** [BedGraphAdapter](../bedgraphadapter)
- **Adapter:** [BedGraphTabixAdapter](../bedgraphtabixadapter)
- **Adapter:** [GCContentAdapter](../gccontentadapter)
- **Adapter:** [BigWigAdapter](../bigwigadapter)
- **State model:** [runtime API](../../models/linearwiggledisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                       | Type                                                      | Description                                                                                                                      |
| ------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [defaultRendering](#slot-defaultrendering) | `stringEnum` (xyplot, density, line, linecenter, scatter) | Default rendering type: `xyplot`, `density`, `line`, `linecenter`, or `scatter`.                                                 |
| [height](#slot-height)                     | `number`                                                  | Default height of the track                                                                                                      |
| [useBicolor](#slot-usebicolor)             | `boolean`                                                 | When true (the default), positive scores use posColor and negative use negColor; when false, all bars use the single color slot. |
| [color](#slot-color)                       | `color`                                                   | Single fill CSS color for the wiggle bars; a wiggle colors per signal, not per feature, so jexl callbacks do not apply.          |
| [summaryScoreMode](#slot-summaryscoremode) | `stringEnum` (max, min, avg, whiskers)                    | choose whether to use max/min/average or whiskers which combines all three into the same rendering                               |

<details>
<summary>Advanced slots (1)</summary>

| Slot                               | Type      | Description                        |
| ---------------------------------- | --------- | ---------------------------------- |
| [minimalTicks](#slot-minimalticks) | `boolean` | Draw only the min/max Y-axis ticks |

</details>

<details>
<summary>LinearWiggleDisplay - Slots</summary>

#### slot: defaultRendering

Default rendering type: `xyplot`, `density`, `line`, `linecenter`, or `scatter`.

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`xyplot`, `density`, `line`, `linecenter`, `scatter`) · **Default:** `'xyplot'`

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

When true (the default), positive scores use posColor and negative use negColor;
when false, all bars use the single color slot. Setting color alone, with no
posColor/negColor/useBicolor, turns this off for you.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: color

Single fill CSS color for the wiggle bars; a wiggle colors per signal, not per
feature, so jexl callbacks do not apply. Set alone it implies useBicolor false;
alongside posColor/negColor it goes unused. Density rendering always draws from
posColor.

**Type:** [`color`](/docs/config_guides/slot_types#color) · **Default:**
`WIGGLE_POS_COLOR_DEFAULT`

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
