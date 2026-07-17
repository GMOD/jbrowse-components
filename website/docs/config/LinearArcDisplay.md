---
id: lineararcdisplay
title: LinearArcDisplay
sidebar_label: Display -> LinearArcDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `arc` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearArcDisplay/configSchema.ts).

## Example usage

Selected on a `FeatureTrack`; each feature is drawn as one arc from its start to
its end. `displayMode` is `arcs` (bezier) or `semicircles`. The `thickness` and
`label` slots default to expressions over the feature `score`, so override them
(plus `color` / `arcHeight`) for data without a score. All style slots are
jexl-evaluated per feature:

```js
{
  type: 'FeatureTrack',
  trackId: 'interactions',
  name: 'Interactions',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://example.com/interactions.gff3.gz',
  },
  displays: [
    {
      type: 'LinearArcDisplay',
      displayId: 'interactions-LinearArcDisplay',
      displayMode: 'semicircles',
      color: "jexl:get(feature,'strand')==-1?'red':'blue'",
      arcHeight: 80,
      label: "jexl:get(feature,'name')",
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Adapter:** [BedAdapter](../bedadapter)
- **Adapter:** [BedTabixAdapter](../bedtabixadapter)
- **Adapter:** [BigBedAdapter](../bigbedadapter)
- **Adapter:** [Gff3Adapter](../gff3adapter)
- **Adapter:** [Gff3TabixAdapter](../gff3tabixadapter)
- **Adapter:** [GtfAdapter](../gtfadapter)
- **Adapter:** [GtfTabixAdapter](../gtftabixadapter)
- **State model:** [runtime API](../../models/lineararcdisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                             | Type                       | Description                                                    |
| -------------------------------- | -------------------------- | -------------------------------------------------------------- |
| [color](#slot-color)             | `color`                    | the color of the arcs                                          |
| [thickness](#slot-thickness)     | `number`                   | the thickness of the arcs                                      |
| [label](#slot-label)             | `string`                   | the label to appear at the apex of the arcs                    |
| [arcHeight](#slot-archeight)     | `number`                   | the height of the arcs                                         |
| [caption](#slot-caption)         | `string`                   | the caption to appear when hovering over any point on the arcs |
| [displayMode](#slot-displaymode) | `enum` (arcs, semicircles) | render semi-circles instead of arcs                            |

<details>
<summary>LinearArcDisplay - Slots</summary>

#### slot: color

the color of the arcs

**Type:** [`color`](/docs/config_guides/slot_types#color) · **Default:**
`'darkblue'`

```js
{
  type: 'color',
  description: 'the color of the arcs',
  defaultValue: 'darkblue',
  contextVariable: ['feature'],
}
```

#### slot: thickness

the thickness of the arcs

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`'jexl:logThickness(feature,'score')'`

```js
{
  type: 'number',
  description: 'the thickness of the arcs',
  defaultValue: `jexl:logThickness(feature,'score')`,
  contextVariable: ['feature'],
}
```

#### slot: label

the label to appear at the apex of the arcs

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'jexl:get(feature,'score')'`

```js
{
  type: 'string',
  description: 'the label to appear at the apex of the arcs',
  defaultValue: `jexl:get(feature,'score')`,
  contextVariable: ['feature'],
}
```

#### slot: arcHeight

the height of the arcs

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`'jexl:log10(get(feature,'end')-get(feature,'start'))*50'`

```js
{
  type: 'number',
  description: 'the height of the arcs',
  defaultValue: `jexl:log10(get(feature,'end')-get(feature,'start'))*50`,
  contextVariable: ['feature'],
}
```

#### slot: caption

the caption to appear when hovering over any point on the arcs

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'jexl:get(feature,'name')'`

```js
{
  type: 'string',
  description:
    'the caption to appear when hovering over any point on the arcs',
  defaultValue: `jexl:get(feature,'name')`,
  contextVariable: ['feature'],
}
```

#### slot: displayMode

render semi-circles instead of arcs

**Type:** `enum` (one of `arcs`, `semicircles`) · **Default:** `'arcs'`

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

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `1` ·
_advanced_

#### slot: fetchSizeLimit

maximum data to attempt to download for a given track, used if adapter doesn't
specify one

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`1_000_000` · _advanced_

#### slot: height

default height for the track

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `100`

#### slot: mouseover

text to display when the cursor hovers over a feature

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'jexl:get(feature,'_mouseOver')||get(feature,'name')||get(feature,'function')||get(feature,'id')'`

```js
{
  type: 'string',
  description: 'text to display when the cursor hovers over a feature',



  defaultValue: `jexl:get(feature,'_mouseOver')||get(feature,'name')||get(feature,'function')||get(feature,'id')`,
  contextVariable: ['feature'],
}
```

#### slot: jexlFilters

config jexlFilters are deferred evaluated so they are prepended with jexl at
runtime rather than being stored with jexl in the config

**Type:** `stringArray` · **Default:** `[`get(feature,'gbkey')!='Src'`]`

</details>
