---
id: gccontentadapter
title: GCContentAdapter
sidebar_label: Adapter -> GCContentAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `gccontent` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/GCContentAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'QuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GCContentAdapter',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

Computes GC content (or GC skew) from an assembly's sequence at render time,
so there is no data file to prepare, and nothing to configure: the sequence
comes from the assembly the track is displayed against.

## Related links

- **Track:** [QuantitativeTrack](../quantitativetrack)
- **Display:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "GCContentAdapter", ... }`. This adapter has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-sequenceadapter">**sequenceAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | don't set this — JBrowse computes GC from the assembly the track is displayed against. It stays as an escape hatch for scoring some *other* sequence, and setting it pins the track to that source even when the assembly's own sequence changes<br>_advanced_ |
| <span id="slot-windowsize">**windowSize**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | width in bp of the window each score is computed over, centered on the position. 1 scores single bases; wider windows smooth the signal<br>_advanced_ |
| <span id="slot-windowdelta">**windowDelta**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | step in bp between successive windows. Equal to `windowSize` (the default) the windows tile without overlapping; smaller values overlap them, giving a denser, smoother signal for proportionally more work<br>_advanced_ |
| <span id="slot-gcmode">**gcMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (content, skew) = <code>'content'</code> | calculate GC content fraction or GC skew (G-C)/(G+C) |
