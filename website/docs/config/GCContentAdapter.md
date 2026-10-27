---
id: gccontentadapter
title: GCContentAdapter
description: "Computes GC content (or GC skew) from an assembly's sequence at render time, so there is no data file to prepare: the sequence comes from the assembly the track is displayed against."
sidebar_label: Adapter -> GCContentAdapter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `gccontent` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/GCContentAdapter/configSchema.ts).

Computes GC content (or GC skew) from an assembly's sequence at render time,
so there is no data file to prepare: the sequence comes from the assembly
the track is displayed against. Each score is the `op` over a `window` of
bases, one every `step`; the `GCContentTrack` menu's GC parameters write
all three.

Only A, C, G and T count. N and the ambiguity codes are left out of both the
fraction and its denominator, so a window holding no A, C, G or T, such as
an assembly gap, has no score, nor does a skew window holding no G or C.

## Example usage

```js
{
  type: 'GCContentTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GCContentAdapter',
  },
}
```

GC skew in fixed 10 kb windows every 1 kb:

```js
{
  type: 'GCContentTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GCContentAdapter',
    op: 'skew',
    window: 10000,
    step: 1000,
  },
}
```

## Related links

- **Track:** [GCContentTrack](../gccontenttrack)
- **Display:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

Adapter slots go inside the track's `adapter`: `"adapter": { "type": "GCContentAdapter", ... }`. `GCContentAdapter` has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-sequenceadapter">**sequenceAdapter**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) | the sequence scored in place of the assembly's own, such as a hard-masked FASTA on the same coordinates. Unset, the track scores the sequence of the assembly it is shown against, and follows that assembly's sequence if it changes<br>_advanced_ |
| <span id="slot-op">**op**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (content, skew) = <code>'content'</code> | `content` is the fraction of bases that are G or C, in [0, 1]; `skew` is (G - C) / (G + C), in [-1, 1] |
| <span id="slot-window">**window**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | bp each score is computed over, centered on the bin it is drawn as. A step wider than the window widens it to the step, so every base is scored. 1 scores single bases; wider windows smooth the signal |
| <span id="slot-step">**step**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>'auto'</code> | bp between successive scores, or `"auto"` to follow the zoom: the largest 1/2/5 rung (1, 2, 5, 10, 20, ... bp) at or under one point per pixel at the display's resolution. A step under the window overlaps the windows for a smoother signal |

## Retired keys

An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.

<!-- prettier-ignore -->
| Key | On load |
| --- | --- |
| `windowSize` | moved into a current slot |
| `windowDelta` | moved into a current slot |
