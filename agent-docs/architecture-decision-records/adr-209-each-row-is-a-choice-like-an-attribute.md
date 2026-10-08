---
status: Accepted
summary: "The arrangement dialog colors rows one way: \"Color rows by\" None, Each row or an attribute, each choice holding its own picks and an Other swatch of Auto, None or a color. Each row is offered on every row display, and its picks are the row list's swatches; None colors no row and edits nothing. A choice starts from `startingRowColor` (the mixin's `rowColorFor`): the current object where it shows that choice, else the config's, else nothing, which the variant menu, the dialog and the reset all read, so picking the config's attribute back after None is the config again, and a reset never changes the choice. `applyRowEdits` takes color only from the object it is handed; the rows carry order and labels (`labelEdits`), and \"Start from\" and the row-diff color rule go. Amends ADR-164 and ADR-207, and states the row color rules those two built up"
---

# ADR-209: Each row is a choice like an attribute

## Status

Accepted (2026-10-04). Amends
[ADR-164](adr-164-the-arrangement-dialog-shows-the-row-color-object.md) and
[ADR-207](adr-207-a-rows-color-resolves-once-and-shows-beside-its-label.md).

## Context

The `rowColor` object already treats a hand-set row color as a value's
color under `field: 'name'`, but the dialog had two ways to hand-pick. Under
an attribute a value table edited the pairs. Under None and Each row a swatch
column in the row list edited each row's resolved color, "Start from" copied
an attribute's colors onto the rows, "Clear row colors" cleared them, and on
submit `rowEdits` diffed every row against what it showed to recover the
pairs. None therefore meant "no palette" on a display that deals one and
"rows by hand" on one that does not, Each row was offered on wiggle overlays
only, and the same object read as None on one display and Each row on
another. Re-picking the config's attribute after None started from the
palette, and a reset was the way back to the config's value colors.

## Decision

- **Three kinds of choice, one shape.** "Color rows by" offers None, Each row
  and the display's attributes on every row display. Each row and an
  attribute each hold their picks, `domain`/`range` under that field, and an
  Other swatch, the `unknown`: Auto (unset), None (`''`) or a color, with
  None hidden where it equals Auto (Each row on stacked rows, where no palette
  deals); Auto and None are toggles pressed while they hold, since the swatch
  shows neither. An attribute's picks are its value table; Each row's are the
  row list's swatches, since the row list already lists every value. The row
  list's swatch column shows each row's color under every choice and edits
  only under Each row, as does the bulk color button. The bulk editor's
  `rowColor` column is Each row's whole pick set, read back as it is pasted,
  so a blanked cell drops a pick.
- **None colors no row.** `rowColorChoiceOf` reads None only for a `name`
  object that colors nothing: no pair, and an `unknown` of `''`, or unset
  where no palette deals. None writes `{ field: 'name' }`, with `unknown: ''`
  where the palette deals. Hand-set row colors are Each row, whatever the
  display.
- **A choice starts from one rule.** `startingRowColor(choice, from,
  paletteDeals)` is the first of `from` showing that choice, else the field
  with no color of its own. The mixin's `rowColorFor(choice)` reads it over
  the current object and the config's, for the variant menu's
  `setRowColorChoice` and the dialog alike, so a reader's colors stand and
  the config's return when its attribute is picked back.
  The reset reads it over the config's alone: `rowColorResetTarget` returns
  the live choice's colors to where that choice starts in the config, never
  changes the choice, and has nothing to reset under None. The dialog keeps a
  draft per choice for the sitting, so switching away and back keeps picks.
- **`applyRowEdits(rows, rowColor)` takes color only from the object.** The
  rows carry order and labels, which `labelEdits` writes as `rowEdits` did;
  the row-diff color rule, its alias and own-color fallbacks, and the
  unparseable-color guard leave the model. A pasted color the painters
  cannot parse is dropped where the paste lands.
- **The menu and the dialog offer one list.** `rowColorAttributesOffered`
  is the display's attributes and the current one where the rows lack it;
  `rowColorChoiceLabel` names each choice. The variant menu's Samples group
  offers None and those attributes, and Each row while it is the choice.

## Consequences

- The dialog loses "Start from" and the None-with-swatches mode; a reader
  colors by an attribute and changes the value's color instead.
- On a stacked display a config `{ domain, range, unknown: '#ccc' }` reads as
  Each row with a grey Other, where ADR-207 read it as None.
- On a wiggle overlay, None is no longer custom against a base that deals the
  palette: a reset keeps the choice, as it does for every other choice.
- Each row with no pick and Other on Auto colors nothing on stacked rows, so
  it is the same object as None and the dialog reopens on None; on an
  overlay, Other on None with no pick does the same.

## Rejected

- **Dropping hand-picked colors for attributes only**: hand-picked
  per-subtrack colors have been in the multi-wiggle dialog since 2022 and
  shipped configs pair group and lineage values with colors.
- **Each row's picks in a value table of their own**: the row list already
  lists every row, so a second list of the same rows would sit beside it.
- **None as an Other swatch state with no None button**: it hides "no
  per-subtrack colors" on a wiggle overlay behind a swatch.
