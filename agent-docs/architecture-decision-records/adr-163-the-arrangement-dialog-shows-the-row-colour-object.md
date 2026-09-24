---
status: Accepted
summary: "The row displays' arrangement dialog is a view of the `rowColor` object and submits it: \"Color rows by\" None, Each row or an attribute (`rowColorChoice`, over `rowColorFields`); under an attribute a table of its values with their colours and row counts, and read-only row swatches; under Each row editable swatches, with \"Start from\" copying an attribute's colours onto them once. `applyRowEdits(rows, rowColor)` reads a row's swatch only under Each row and writes any other object as shown, so a recolour under a Color by no longer turns every row into a `name` pair. The dialog's own Color by (the palettizer) is gone, the deal hook becomes `rowColorDealFor(setting)` so the dialog can preview a setting, wiggle and multi-row deal by an attribute, where on wiggle the attribute's colour leads a subtrack's own, and the variant menu's Samples group gains Each row. Settles ADR-160's call 5. No migration"
---

# ADR-163: The arrangement dialog shows the row colour object

## Status

Accepted (2026-09-24), Colin's answer to ADR-160's call 5 after a mock of the
dialog (today's beside this one). A recolour under a Color by had to guess what
the reader meant; he asked for the form to be redesigned instead.

## Context

`rowColor` is one object: a `field` whose values take colours, `name` by
default, and `domain`/`range` pairing that field's values with colours
(ADR-160). The dialog showed none of that. It listed rows with a swatch each and
had a "Color by" button of its own that painted every row a colour by an
attribute, leaving no attribute behind, while the track menu's Color by set one.
So "colour by an attribute" had two homes that wrote different things, and a
swatch edited under a Color by could mean "this row" or "this value". The code
took the first: it turned every row's current colour into a `name` pair,
switched the field to `name`, and so dropped the Color by, its legend and its
way back on a reset.

## Decision

- **The dialog shows the object and submits it.** A "Color rows by" choice
  above the rows reads `rowColorChoice`: None (`scale: 'none'`, keeping the
  field and its entries for the way back), Each row (`name`), or one of the
  display's `rowColorFields`. Under an attribute the dialog lists its values,
  each with its colour, previewed through `rowColorsFor`, and how many rows
  carry it; a value's colour is an entry under that attribute, and the rows'
  swatches show it without editing it. Under Each row the swatches edit, and
  "Start from" copies an attribute's colours onto them once, which is how a
  reader colours by population and then changes one sample. "Clear row colors"
  replaces the palettizer's clear.
- **`applyRowEdits(rows, rowColor)` reads a row's swatch only under Each row.**
  There `rowEdits` is the rule it was, over the pairs the config holds under
  `name`, or none when the object painted another field. Any other object is
  written as the dialog shows it, and not at all when it equals the config's.
  Called without an object, as a drag or a test does, the config's own stands.
  Nothing is materialised.
- **The deal hook takes a setting.** `rowColorDealFor(setting)` replaces the
  `rowColorDeal` getter as the hook, so the dialog can preview a setting it has
  not written; `rowColorDeal` applies it to the config's object, none under
  `scale: 'none'`, which the mixin now decides for every display.
- **Wiggle and multi-row deal by an attribute.** Under `name` each keeps the
  palette it dealt before ADR-160; under an attribute, that attribute's values
  over the base arrangement, wiggle from `set1`, the palette it already uses.
  On wiggle the attribute's colour leads a subtrack's own, since the reader
  asked for it; under `name` the subtrack's own leads as before. MAF and the
  mark display offer no attribute; multi-row's rows carry none until their
  groups are tagged, which happens after the arrangement.
- **The variant menu offers the same choices.** Color by → Samples gains Each
  row between None and the attributes, and `setRowColorField` compares against
  the choice, so None from Each row now takes.

## Consequences

- A dialog swatch under a Color by no longer recolours anything; the value's
  colour does, for every row carrying it.
- A recolour under `name` on wiggle and multi-row deals the palette again,
  since the hook reads the whole object: one census row each moves from 0 to 1.
- `paletteColorsByRow`, `RowPalettizer` and `enableRowPalettizer` are gone.
- A config writing `rowColor: 'group'` on wiggle now colours by group, where it
  did nothing before.

## Rejected

- **Each row's colour as a `name` pair, materialised on a recolour** (what
  shipped): a guess that loses the Color by, its legend and its reset.
- **Locked swatches under a Color by, and no value table**: plain, but it left
  "make EUR darker" with no home but a config file.
