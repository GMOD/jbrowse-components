---
id: syntenyoffscreen
title: SyntenyOffscreen
description: "The linear synteny view's offscreen part: a mark along each edge of a band for every alignment whose other end lies where the facing row is not looking, which a click follows there."
sidebar_label: View -> SyntenyOffscreen
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyView/offscreenConfigSchema.ts).

The linear synteny view's `offscreen` part: a mark along each edge of a
band for every alignment whose other end lies where the facing row is not
looking, which a click follows there.

## Example usage

```js
{ type: 'LinearSyntenyView', offscreen: { show: false } }
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the marks; off also skips the second query per pair of rows they cost |
