---
id: parkedcolormixin
title: ParkedColorMixin
description: "The field the last write took off a color object, with its domain, range and key names, so picking that field again gives them back (colorForField)."
sidebar_label: Mixin -> ParkedColorMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/ParkedColorMixin.ts).

The field the last write took off a color object, with its domain, range and key names, so picking that field again gives them back (`colorForField`). A written field always paints, so the field a write leaves, for Default, Solid color or another field, is display state rather than config. `slot` names the color object and `writtenOf` reads it as written; any action on the model moving its field parks the field it leaves, in that same action, whichever menu, dialog or Edit plot made it. A display with two color objects composes it once for each

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-parkedcolors">**parkedColors**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>parkedColors: types.maybe(types.frozen&lt;Record&lt;string, ColorSlot…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>parkedColors: types.maybe(types.frozen&lt;Record&lt;string, ColorSlots&gt;&gt;())</code></pre></dialog></span> | By color object, the field the last write away from one left, with its members |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-parkedcolor">**parkedColor**</span><br><code>ColorSlots &#124; undefined</code> | The `color` object's parked field |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-parkedcolorof">**parkedColorOf**</span><br><code>(name: string) =&gt; ColorSlots &#124; undefined</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-parkcolor">**parkColor**</span><br><code>(name: string, color: ColorSlots) =&gt; void</code> |  |
