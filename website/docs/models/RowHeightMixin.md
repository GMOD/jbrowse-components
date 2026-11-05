---
id: rowheightmixin
title: RowHeightMixin
description: "The two-valued row height every scrolling row display has. A rows.step (RowsWithStep) of px or \"fit\", and an autoRowHeight getter saying what fit divides."
sidebar_label: Mixin -> RowHeightMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/tree-sidebar/src/rowHeight/RowHeightMixin.ts).

The two-valued row height every scrolling row display has. A `rows.step` (`RowsWithStep`) of px or `"fit"`, and an `autoRowHeight` getter saying what fit divides. Brings the `rowStep` getter, `setRowHeight`, `setFitToHeight`, and the resolved `effectiveRowHeight` every consumer reads

The convention itself is
agent-docs/reference/ROW_HEIGHT_AND_FIT.md; this is the middle link of it.
`rowHeightMenuItem` and `SetRowHeightDialog` in this directory are the one
menu row and dialog for every row display, and `resolveRowHeight` in core is
the one place `"fit"` resolves and a non-positive result is floored.
This mixin sits between them, in place of hand-written copies — the
multi-row feature painting and the multi-sample variant base — of the slot,
the getter over it and the setters. MAF is always-fit and composes none of it.

**The mixin declares the members this package depends on.**
`rowHeightMenu` restates `rowStep` / `setRowHeight` / `setFitToHeight` as
`RowHeightModel` and `types.ts`'s `TreeDrawingModel` restates
`effectiveRowHeight`, so a display wiring in the shared menu and spelling one
of them differently would compile and then fail at the first click. Slots and
accessors move together, matching `rowAxisConfigSchema` + `TreeSidebarMixin`.

**What stays per display is the value, not the declaration.** The one
per-display member is `autoRowHeight`, because the height available to rows
is a different quantity in each (the mark display's plot, variants'
`availableHeight`).

`effectiveRowHeight` is overridable, and one display overrides it: the mark
display honours a px `rows.step` only while it draws rows.

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-rowstep">**rowStep**</span><br><code>RowStep</code> | `rows.step`: a fixed px row height, or `"fit"`. The resolved value is `effectiveRowHeight` — consumers read that, never this; the menu and the dialog read this, since fit is no height. On the config rather than the display snapshot for the same reason `height` is: the config node outlives the display instance, so a fixed height survives unticking and reticking the track. |
| <span id="getter-autorowheight">**autoRowHeight**</span><br><code>number</code> | The height fit mode divides between the rows, declared here and **overridden by every display** — the quantity differs in each, so this stub is a slot for the answer rather than an answer. Declaring it lets `effectiveRowHeight` below read a member with a declared type instead of one asserted onto `self`.<br><br>A display that composes the mixin and supplies no override resolves to a 1px row, the same as when the read finds `undefined`: `resolveRowHeight` floors both.<br><br>Supply it as a **getter**, the way all three displays do. Mobx refuses to write a volatile over a computed, so a `.volatile` of this name throws at `create` — loudly, and before any row is drawn. |
| <span id="getter-effectiverowheight">**effectiveRowHeight**</span><br><code>number</code> | Resolved per-row height. `rows.step: "fit"` divides the display's own `autoRowHeight` across the rows; a px step is the fixed height, used as-is however many rows there are.<br><br>Sub-pixel is legitimate and deliberately not floored here — a cohort with more rows than the track has pixels has a genuinely fractional row height, and flooring it makes the content taller than the height it was asked to fit inside. `resolveRowHeight` floors only a **non-positive** result, which consumers divide by. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setrowheight">**setRowHeight**</span><br><code>(px: number) =&gt; void</code> | Pin a px row height, `rows.step`, which refuses one at or below 0. |
| <span id="action-setfittoheight">**setFitToHeight**</span><br><code>() =&gt; void</code> | Fit the rows to the track: `rows.step: "fit"` divides `autoRowHeight` between them. |
