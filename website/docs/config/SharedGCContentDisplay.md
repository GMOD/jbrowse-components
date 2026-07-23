---
id: sharedgccontentdisplay
title: SharedGCContentDisplay
sidebar_label: Display -> SharedGCContentDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gccontent`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/LinearGCContentDisplay/sharedConfigSchema.ts).

## Example usage

On a `ReferenceSequenceTrack` — no extra adapter needed, GC is derived from the
track's sequence adapter. `gcMode` is `content` or `skew`:

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

On a standalone `GCContentTrack` whose `GCContentAdapter` wraps a sequence
adapter (use this instead of the `ReferenceSequenceTrack` display when you want
GC as its own track):

```js
{
  type: 'GCContentTrack',
  trackId: 'gc',
  name: 'GC content',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GCContentAdapter',
    sequenceAdapter: {
      type: 'IndexedFastaAdapter',
      fastaLocation: { uri: 'https://example.com/genome.fa' },
      faiLocation: { uri: 'https://example.com/genome.fa.fai' },
    },
  },
  displayDefaults: { gcMode: 'skew', windowSize: 50, windowDelta: 10 },
}
```

_See the **Config slots** section below for all available configuration fields._

Shared config for the two GC content displays: `LinearGCContentDisplay` (on a
`ReferenceSequenceTrack`, deriving GC from the track's own sequence adapter) and
`LinearGCContentTrackDisplay` (on a standalone `GCContentTrack`). Both register
the same slots against different track types, so the slots live here once.

## Related links

- **Base config:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                       | Type                                   | Description                                                                                                                                                                                                                                                                    |
| ------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [windowSize](#slot-windowsize)             | `number`                               | Number of bases per GC measurement window.                                                                                                                                                                                                                                     |
| [windowDelta](#slot-windowdelta)           | `number`                               | Step between successive windows; smaller than `windowSize` means overlapping windows (a smoother signal).                                                                                                                                                                      |
| [gcMode](#slot-gcmode)                     | `stringEnum` (content, skew)           | `content` for GC percentage, `skew` for (G-C)/(G+C) strand skew.                                                                                                                                                                                                               |
| [summaryScoreMode](#slot-summaryscoremode) | `stringEnum` (max, min, avg, whiskers) | GCContentAdapter never emits real per-bin min/max, so the inherited 'whiskers' default has no summary to draw — it just forces posColor-only rendering (buildSourceRenderData skips the bicolor pos/neg split for whiskers) and hides negative GC-skew as if it were positive. |

<details>
<summary>SharedGCContentDisplay - Slots</summary>

#### slot: windowSize

Number of bases per GC measurement window.

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `100`

#### slot: windowDelta

Step between successive windows; smaller than `windowSize` means overlapping
windows (a smoother signal).

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `100`

#### slot: gcMode

`content` for GC percentage, `skew` for (G-C)/(G+C) strand skew.

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`content`, `skew`) · **Default:** `'content'`

#### slot: summaryScoreMode

GCContentAdapter never emits real per-bin min/max, so the inherited 'whiskers'
default has no summary to draw — it just forces posColor-only rendering
(buildSourceRenderData skips the bicolor pos/neg split for whiskers) and hides
negative GC-skew as if it were positive.

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`max`, `min`, `avg`, `whiskers`) · **Default:** `'avg'`

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details>
<summary>Inherited from LinearWiggleDisplay</summary>

[LinearWiggleDisplay config →](../linearwiggledisplay)

#### slot: defaultRendering

Default rendering type: `xyplot`, `density`, `line`, `linecenter`, or `scatter`.

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

</details>
