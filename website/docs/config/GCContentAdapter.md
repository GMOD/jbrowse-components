---
id: gccontentadapter
title: GCContentAdapter
sidebar_label: Adapter -> GCContentAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gccontent`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/GCContentAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'QuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GCContentAdapter',
    sequenceAdapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://example.com/hg38.fa.gz',
    },
  },
}
```

_See the **Config slots** section below for all available configuration fields._

Computes GC content (or GC skew) from an assembly's sequence at render time, so
there is no data file to prepare. `sequenceAdapter` is required and is normally
a copy of the assembly's own sequence adapter.

## Related links

- **Track:** [QuantitativeTrack](../quantitativetrack)
- **Display:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "GCContentAdapter", ... }`. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-sequenceadapter">**sequenceAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> |  |
| <span id="slot-windowsize">**windowSize**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | _advanced_ |
| <span id="slot-windowdelta">**windowDelta**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | _advanced_ |
| <span id="slot-gcmode">**gcMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (content, skew) = <code>'content'</code> | calculate GC content fraction or GC skew (G-C)/(G+C) |
