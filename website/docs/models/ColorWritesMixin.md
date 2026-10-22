---
id: colorwritesmixin
title: ColorWritesMixin
description: "The writes a display's color object takes from a menu row or a picker: the field it paints by (colorByField) and the constant every feature paints (setColorValue)."
sidebar_label: Mixin -> ColorWritesMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/ColorWritesMixin.ts).

The writes a display's `color` object takes from a menu row or a picker: the field it paints by (`colorByField`) and the constant every feature paints (`setColorValue`). Each rewrites the object as written, so what a pick leaves alone stays as it was, and a pick of what already paints writes nothing, since every color tier keys on the object's arrays. A pick away from a field parks it (`ParkedColorMixin`), so picking it again keeps its domain, range and key names. A dialog's Apply button writes the whole object through `applyPlot`, which rebuilds the display's config for the draft, too dear for a picker writing once per drag frame

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<details class="inherited-members" data-pagefind-ignore>
<summary>1 inherited property from one model</summary>

From [ParkedColorMixin](../parkedcolormixin): <span id="property-parkedcolors">[`parkedColors`](../parkedcolormixin#property-parkedcolors)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-writtencolor">**writtenColor**</span><br><code>ColorSlots</code> | The `color` object as these writes and an Apply button read it, `writtenColorOf`. |

<details class="inherited-members" data-pagefind-ignore>
<summary>1 inherited getter from one model</summary>

From [ParkedColorMixin](../parkedcolormixin): <span id="getter-parkedcolor">[`parkedColor`](../parkedcolormixin#getter-parkedcolor)</span>

</details>

## Methods

<details class="inherited-members" data-pagefind-ignore>
<summary>1 inherited method from one model</summary>

From [ParkedColorMixin](../parkedcolormixin): <span id="method-parkedcolorof">[`parkedColorOf`](../parkedcolormixin#method-parkedcolorof)</span>

</details>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-colorbyfield">**colorByField**</span><br><code>(field: string) =&gt; void</code> | Paint by `field`, keeping its domain, range and key names while it is the field already painting or the one parked; `''` paints `value` and parks the field. |
| <span id="action-setcolorvalue">**setColorValue**</span><br><code>(value: string &#124; undefined) =&gt; void</code> | Paint every feature `value`, a CSS color or a `jexl:` callback, parking the field; undefined lets each feature's own color paint. |
| <span id="action-pickdefaultcolor">**pickDefaultColor**</span><br><code>() =&gt; void</code> | Color by's Default: no field and no constant, so the track's own color paints, a `jexl:` expression included. |
| <span id="action-picksolidcolor">**pickSolidColor**</span><br><code>() =&gt; void</code> | Color by's Solid color...: paints the constant kept beside a painting field, where there is one, and opens the display's picker. |

<details class="inherited-members" data-pagefind-ignore>
<summary>1 inherited action from one model</summary>

From [ParkedColorMixin](../parkedcolormixin): <span id="action-parkcolor">[`parkColor`](../parkedcolormixin#action-parkcolor)</span>

</details>
