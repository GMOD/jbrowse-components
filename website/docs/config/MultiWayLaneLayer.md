---
id: multiwaylanelayer
title: MultiWayLaneLayer
description: "One row of data drawn in every lane through that lane's own frame, from each genome's own track, on one value scale shared by every lane."
sidebar_label: Display -> MultiWayLaneLayer
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/laneLayerConfigSchema.ts).

One row of data drawn in every lane through that lane's own frame, from
each genome's own track, on one value scale shared by every lane.

## Example usage

GC percent as bars above every lane's genes, from each genome's UCSC
gc5Base bigWig added as a track with the trackId `<genome>-gc5Base`:

```js
{
  type: 'MultiWaySyntenyDisplay',
  displayId: 'hg38_liftover_multiway-MultiWaySyntenyDisplay',
  laneLayers: [
    {
      name: 'GC %',
      tracks: ['{assembly}-gc5Base'],
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
      adapter: { type: 'GCContentAdapter', window: 1000 },
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
    },
  ],
}
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | label of the layer's band |
| <span id="slot-tracks">**tracks**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the trackIds the lanes draw the layer from, matched to a lane by the track's assembly. An entry spelling `{assembly}`, such as `{assembly}-gc5Base`, names in each lane the track whose id has that lane's genome, or any of its aliases, written there. Plain ids outrank `{assembly}` entries, and an earlier entry outranks a later one. A lane no entry names draws an empty band |
| <span id="slot-adapter">**adapter**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) = <code>undefined</code> | an adapter computing from the sequence, such as `{ type: 'GCContentAdapter' }`, which each lane that `tracks` names nothing for reads through that lane's genome. A lane reads it only while its window is under 5 Mb, since that window is the sequence it downloads, and the band's title tells the reader to zoom in past that |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>24</code> | px of band the layer takes in each lane |
| <span id="slot-marks">**marks**</span><br>[list of Mark entries](../linearmarkdisplay#slot-marksencodingshapevalue) | The mark display's marks, drawn over each lane's features; a mean such as a bigWig's `score` compares across lanes, where a `count` or `sum` reads denser on a zoomed-out lane. |
