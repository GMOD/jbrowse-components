---
id: colorwritesmixin
title: ColorWritesMixin
description: "The writes a display's color object takes from a menu row or a picker: the field it paints by (colorByField) and the constant every feature paints (setColorValue). Each rewrites the object as…"
sidebar_label: Mixin -> ColorWritesMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/ColorWritesMixin.ts).

The writes a display's `color` object takes from a menu row or a picker: the field it paints by (`colorByField`) and the constant every feature paints (`setColorValue`). Each rewrites the object as written, so what a pick leaves alone stays as it was, and a pick of what already paints writes nothing, since every color tier keys on the object's arrays. A dialog's Apply button writes the whole object through `applyPlot`, which rebuilds the display's config for the draft, too dear for a picker writing once per drag frame

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-colorbyfield">**colorByField**</span><br><code>(field: string) =&gt; void</code> | Paint by `field`, keeping its domain, range and key names while it is the field already painting; `''` paints `value` and keeps the field under `scale: 'none'` for the way back. |
| <span id="action-setcolorvalue">**setColorValue**</span><br><code>(value: string &#124; undefined) =&gt; void</code> | Paint every feature `value`, a CSS color or a `jexl:` callback, keeping a field under `scale: 'none'` for the way back; undefined lets each feature's own color paint. |
