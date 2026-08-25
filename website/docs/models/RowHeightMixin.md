---
id: rowheightmixin
title: RowHeightMixin
sidebar_label: Mixin -> RowHeightMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/tree-sidebar/src/rowHeight/RowHeightMixin.ts).

#crossCuttingMixin The two-valued row height every multi-row display has. A
`rowHeightConfigSchemaFields` slot whose `0` means fit-to-display-height, and an
`autoRowHeight` getter saying what that fit divides. Brings the raw `rowHeight`
getter, `setRowHeight`, and the resolved `effectiveRowHeight` every consumer
reads

The convention itself is agent-docs/reference/ROW_HEIGHT_AND_FIT.md; this is the
middle link of it. **Both ends were already shared**: `rowHeightMenuItem` and
`SetRowHeightDialog` in this directory are the one menu row and dialog for every
row display, and `resolveRowHeight` in core is the one place the `0` sentinel
resolves and a non-positive result is floored. What sat between them was three
hand-written copies — maf, the multi-row feature painting and the multi-sample
variant base — of the slot, the getter over it and the setter.

**This package already depended on members it did not declare.** `rowHeightMenu`
restates `rowHeight` / `setRowHeight` / `setFitToHeight` as `RowHeightModel` and
`types.ts`'s `TreeDrawingModel` restates `effectiveRowHeight`, so a display
wiring in the shared menu and spelling one of them differently compiled and then
failed at the first click. Slots and accessors now move together, matching
`treeSidebarConfigSchemaFields` + `TreeSidebarMixin`.

**What stays per display is the value, not the declaration**, and the doc says
which: `autoRowHeight`, because the height available to rows is a different
quantity in each (canvas's `fitTargetHeight`, maf's `rowsHeight`, variants'
`availableHeight`), and `setFitToHeight`, because seeding the `height` slot on
the way in is required exactly where the `height` getter is content-derived and
wrong where it is the slot itself.

`effectiveRowHeight` is overridable, and one display overrides it: the multi-row
feature painting caps the row stack at the canvas limit, since it sizes its
canvas to its content instead of scrolling a viewport.

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-rowheight">**rowHeight**</span><br><code>number</code> | Raw per-row height setting: `0` is fit-to-display-height, any positive value is a fixed px height. The resolved value is `effectiveRowHeight` — consumers read that, never this. On the config rather than the display snapshot for the same reason `height` is: the config node outlives the display instance, so a fixed height survives unticking and reticking the track. |
| <span id="getter-autorowheight">**autoRowHeight**</span><br><code>number</code> | The height fit mode divides between the rows, declared here and **overridden by every display** — the quantity differs in each, so this stub is a slot for the answer rather than an answer. Declaring it is what lets `effectiveRowHeight` below read a member of its own type instead of one asserted onto `self`.<br><br>A display that composes the mixin and supplies no override resolves to a 1px row, exactly as it did when this getter did not exist and the read found `undefined`: `resolveRowHeight` floors both.<br><br>Supply it as a **getter**, the way all three displays do. Mobx refuses to write a volatile over a computed, so a `.volatile` of this name throws at `create` — loudly, and before any row is drawn. |
| <span id="getter-effectiverowheight">**effectiveRowHeight**</span><br><code>number</code> | Resolved per-row height. `rowHeight === 0` divides the display's own `autoRowHeight` across the rows; any positive value is the fixed px height, used as-is however many rows there are.<br><br>Sub-pixel is legitimate and deliberately not floored here — a cohort with more rows than the track has pixels has a genuinely fractional row height, and flooring it makes the content taller than the height it was asked to fit inside. `resolveRowHeight` floors only a **non-positive** result, which consumers divide by. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setrowheight">**setRowHeight**</span><br><code>(n: number) =&gt; void</code> | Pin a px row height. `0` is the fit sentinel, but enter fit mode through `setFitToHeight` instead — displays whose `height` getter is content-derived have to re-seed the slot on the way in, and that is what the action is for. |
