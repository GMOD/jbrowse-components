---
id: syntenyrender
title: SyntenyRender
description: "How the linear synteny and circular views rasterize their ribbons, apart from what the data says: antialias gives a ribbon thinner than a pixel the share of the pixel it covers, so an unfiltered…"
sidebar_label: View -> SyntenyRender
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyRenderConfigSchema.ts).

How the linear synteny and circular views rasterize their ribbons, apart
from what the data says: `antialias` gives a ribbon thinner than a pixel
the share of the pixel it covers, so an unfiltered whole-genome view reads
as the density it has rather than a solid block.

## Example usage

```js
{ type: 'LinearSyntenyView', render: { antialias: false } }
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-antialias">**antialias**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | fade a sub-pixel ribbon by the share of the pixel it covers, down to 0.15 of its alpha; ribbon edges stay antialiased either way. Unset fades once sub-pixel ribbons dominate a display |
