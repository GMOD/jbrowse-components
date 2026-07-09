---
id: lineargccontentdisplay
title: LinearGCContentDisplay
sidebar_label: Display -> LinearGCContentDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gccontent`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/LinearGCContentDisplay/config1.ts).

## Example usage

This display attaches to a `ReferenceSequenceTrack` — it derives GC from the
track's own sequence adapter, so no extra adapter is needed. `gcMode` is
`content` or `skew`:

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'refseq',
  name: 'Reference sequence',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'IndexedFastaAdapter',
    uri: 'https://example.com/genome.fa',
  },
  displays: [
    {
      type: 'LinearGCContentDisplay',
      displayId: 'refseq-LinearGCContentDisplay',
      windowSize: 100,
      windowDelta: 100,
      gcMode: 'content',
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Adapter:** [BgzipFastaAdapter](../bgzipfastaadapter)
- **Adapter:** [ChromSizesAdapter](../chromsizesadapter)
- **Adapter:** [IndexedFastaAdapter](../indexedfastaadapter)
- **Adapter:** [TwoBitAdapter](../twobitadapter)
- **Adapter:** [UnindexedFastaAdapter](../unindexedfastaadapter)
- **State model:** [runtime API](../../models/lineargccontentdisplay)
- **Base config:** [LinearWiggleDisplay](../linearwiggledisplay)

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

#### slot: color

Single fill color for the wiggle bars. Only used when useBicolor is false
(useBicolor defaults to true, in which case posColor/negColor are used instead).

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
