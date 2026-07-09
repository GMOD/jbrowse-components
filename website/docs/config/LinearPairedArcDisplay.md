---
id: linearpairedarcdisplay
title: LinearPairedArcDisplay
sidebar_label: Display -> LinearPairedArcDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `arc` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearPairedArcDisplay/configSchema.ts).

## Example usage

Selected on a `VariantTrack` of structural variants: each feature draws an arc
from its position to its mate breakend (parsed from the VCF `ALT`), connecting
the two loci even when the mate is on another chromosome / displayed region.
Short ticks mark each breakend's mate direction; clicking an arc opens the
variant details. `color` is jexl-evaluated per `(feature, alt)`:

```js
{
  type: 'VariantTrack',
  trackId: 'sv',
  name: 'Structural variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/sv.vcf.gz',
  },
  displays: [
    {
      type: 'LinearPairedArcDisplay',
      displayId: 'sv-LinearPairedArcDisplay',
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Adapter:** [BedpeAdapter](../bedpeadapter)
- **Adapter:** [StarFusionAdapter](../starfusionadapter)
- **Adapter:** [SplitVcfTabixAdapter](../splitvcftabixadapter)
- **Adapter:** [VcfAdapter](../vcfadapter)
- **Adapter:** [VcfTabixAdapter](../vcftabixadapter)
- **State model:** [runtime API](../../models/linearpairedarcdisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                 | Type    | Description           |
| -------------------- | ------- | --------------------- |
| [color](#slot-color) | `color` | the color of the arcs |

<details>
<summary>LinearPairedArcDisplay - Slots</summary>

#### slot: color

the color of the arcs

**Type:** [`color`](/docs/config_guides/slot_types#color) · **Default:**
`'jexl:defaultPairedArcColor(feature,alt)'`

```js
{
  type: 'color',
  description: 'the color of the arcs',
  defaultValue: 'jexl:defaultPairedArcColor(feature,alt)',
  contextVariable: ['feature', 'alt'],
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
