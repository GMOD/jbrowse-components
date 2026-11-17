---
name: one-row-per-and-group-by-on-the-multi-row-display
description: The multi-row display's track menu shows both "One row per" and "Group by" while wiggle says "Rows by", because the split is ADR-257's rows.field against ADR-247's bands; relabeling belongs to the rows grammar pass, not a label sweep.
---

# "One row per" and "Group by" on the multi-row display

The multi-row display's track menu carries two rows that read as near
synonyms to a user:

- **One row per** (`plugins/marks/src/LinearMultiRowFeatureDisplay/multiRowMenus.ts`,
  `rowsFieldMenuItems`) sets `rows.field`, the attribute whose values become
  rows (ADR-257).
- **Group by** (`packages/display-kit/src/groupByMenu.ts`) sets a facet on a row
  attribute, which stacks the rows in labelled bands (ADR-247).

The wiggle display words the same row choice as **Rows by** (`Rows by <field>`
in `plugins/wiggle/src/shared/wiggleMenuItems.tsx`), so one idea has three
labels across two displays.

## Why a label sweep is the wrong fix

The two menu rows are not the same control. One decides what a row is; the other
decides how rows are gathered once they exist. Making them agree by renaming one
of them would either hide that difference or promise a merge the model does not
have. The words follow from the grammar: `rows.field` is the row channel, a
facet on a row attribute is a band, and the user-facing names should fall out of
whichever vocabulary the rows grammar pass settles on.

## What a decision needs first

- Whether the grammar keeps `rows.field` and the row-attribute facet as two
  settings, or folds banding into the rows object.
- One name per setting across the multi-row, wiggle and variant displays, chosen
  once and applied together, with the tests that name the old labels
  (`model.test.ts` asserts on `Group by`).
- The reading a user needs: "One row per X" and "Rows by X" say the same thing,
  so at most one of them survives.

Until that pass, leave all three labels as they are.
