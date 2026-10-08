---
id: multiwaylanelayer
title: MultiWayLaneLayer
sidebar_label: Display -> MultiWayLaneLayer
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/laneLayerConfigSchema.ts).

## Example usage

GC percent as bars above every lane's genes, from each genome's UCSC
gc5Base bigWig added as a track:

```js
{
  type: 'MultiWaySyntenyDisplay',
  displayId: 'hg38_liftover_multiway-MultiWaySyntenyDisplay',
  laneLayers: [
    {
      name: 'GC %',
      tracks: ['hg38-gc5Base', 'panTro6-gc5Base', 'mm39-gc5Base'],
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
    },
  ],
}
```

GC content computed from each genome's own sequence, one entry for every
lane, a hub star's lanes on genomes the session lacks included:

```js
{
  type: 'MultiWaySyntenyDisplay',
  displayId: 'hg38_liftOver_multiway-MultiWaySyntenyDisplay',
  laneLayers: [
    {
      name: 'GC',
      adapter: { type: 'GCContentAdapter', windowSize: 1000, windowDelta: 1000 },
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

One row of data drawn in every lane through that lane's own frame, from
each genome's own track, on one value scale shared by every lane.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | what the layer's band is labelled |
| <span id="slot-tracks">**tracks**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the trackId each lane draws the layer from, one per genome, matched to a lane by the track's assembly. A lane no entry names draws an empty band |
| <span id="slot-adapter">**adapter**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) = <code>undefined</code> | an adapter computing from the sequence, such as `{ type: 'GCContentAdapter' }`, that every lane `tracks` names nothing for reads through its own genome. A lane reads it only while its window is under 5 Mb, since that window is the sequence it downloads, and the band's title says to zoom in past that |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>24</code> | px of band the layer takes in each lane |
| <span id="slot-marks">**marks**</span><br><code>markListSchema([{ mark: 'bar', encoding: { y: 'score' } }])</code> | The mark display's marks, drawn over each lane's features; a mean such as a bigWig's `score` compares across lanes, where a `count` or `sum` reads denser on a zoomed-out lane. |
