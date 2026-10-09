---
status: Accepted
summary: "Every display whose menus pick a color field or a constant composes display-kit's `ColorWritesMixin`, whose `colorByField(field)` and `setColorValue(value)` rewrite the object as written through `colorForField` and `colorForValue`, and write nothing where the pick already paints. A dialog with an Apply button writes the whole object through `applyPlot({ color })`. The per-display setters go: alignments' `setColorBy`, `setColorByTag` and `setColor`, canvas's `setFeatureColor` and `setColorScale`, MAF's and multi-sample variants' `setColorField`, and the multi-sample and wiggle `setColor`; Hi-C's log toggle is `setLogScale`. Alignments' Color by menu speaks fields, so `colorFieldOptions` replaces `pickColorOptions`"
---

# ADR-223: A color object takes two writes, and an Apply button `applyPlot`

## Status

Accepted (2026-10-09), the second item of the grammar convergence the
2026-10-09 analysis and its two reviews ordered. Changes how
[ADR-148](adr-148-the-alignments-read-fill-is-the-color-object.md) writes the
read fill back; its runtime form, the scheme name, stays.

## Context

The color object had one shape on every display
([ADR-135](adr-135-the-color-objects-share-one-shape-and-a-preset-is-a-field.md))
and a write path per display, each a different subset of display-kit's
`colorForField` and `colorForValue`: alignments' `setColorBy`, `setColorByTag`
and `setColor`; canvas's `setFeatureColor`, `setColorScale` and `colorByField`;
MAF's `setColorField`; the multi-sample variant display's `setColorField` and
`setColor`; wiggle's `setColor`; Hi-C's `setColorScale`.

The copies drifted. Canvas and the multi-sample display wrote over
`colorSetting`, which holds only the painted slots, so re-picking the field
already painting dropped the key's `labels` and `title`. One name,
`setColorScale`, wrote a categorical scale on canvas and the log toggle on
Hi-C. A plugin author or the agent API had to learn a different verb per
display for the same pick.

## Decision

- **Two writes, once.** `ColorWritesMixin` (`packages/display-kit`) gives the
  alignments, canvas feature, MAF and multi-sample variant displays
  `colorByField(field)` and `setColorValue(value)`. Each reads the object as
  written, `getSnapshot` of the `color` node, so a pick keeps what it does not
  change, and skips a write that would change nothing, since every color tier
  keys on the object's arrays.
- **An Apply button writes `applyPlot`.** A dialog that sets more than a field
  or a constant (the Tag dialog's scale, the variant cell dialog's cuts,
  wiggle's two-color plot) writes `applyPlot({ color })`. A picker that writes
  once per drag frame does not, since `applyPlot` rebuilds the display config
  for its draft; it calls `setColorValue`.
- **Alignments' menus name fields.** A radio holds a field, `''` for the plain
  fill, and checks against the `colorField` getter. `colorFieldOptions`
  replaces `pickColorOptions` for a display curating its radios (LGV synteny).
  `ReadColorBy` and `ColorBy` stay exported: the `colorBy` getter returns the
  runtime form, and a composing display's declarations have to name it.
- **Kept**: the view-level `TrackColorsMixin.setColorField`, the multi-way
  ribbon and gene pair and `CircularView`'s, each writing a color object no
  display owns; Hi-C's scheme and percentile toggles and LD's metric, each one
  slot a menu row names. Hi-C's log toggle is `setLogScale(log)`.

## Consequences

A display whose menus pick a field or a constant composes the mixin, or they
have nothing to call. Wiggle, Hi-C, LD and the mark display compose none: their
color UI is a dialog writing `applyPlot` or a one-slot toggle. The removed
actions fail as `is not a function` in a plugin or a script still calling
them; `reference/PLUGIN_ABI_STABILITY.md` covers the release note.
