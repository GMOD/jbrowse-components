---
status: Accepted
summary: "The mark display's `encoding` gains `color`, a MarkColor beside `y` (`MarkDisplayEncoding`): a mark whose own `encoding.color` names no value, field or scale paints through it, as a ggplot2 layer takes the plot's aesthetics it leaves unset. One helper, `paintedColorNode`, answers which color a mark paints through, and every reader takes it: the worker request, the main-thread paint, the key and the text labels. The rule list checks the display's color once, at the display, and each mark's own where it names one. It lets the multi-row display keep its display-level `encoding.color` when it becomes the mark display with a default rect"
---

# ADR-248: A mark naming no color paints the display's

## Status

Accepted (2026-10-25), Colin's "go for it" on the swap's one design call in
the multi-row swap plan, retired by
[ADR-249](adr-249-the-multi-row-display-is-the-mark-display-with-a-paintings-default-plot.md).

## Context

Every multi-row config writes its color at the display, `encoding.color`.
The mark display wrote colors only on its marks, so the subtype would have
had to rewrite every config, tutorial and add-track route into
`marks: [{ mark: 'rect', encoding: { color } }]`, or bridge the two
spellings in its own code.

## Decision

- **The display's `encoding` holds `color` beside `y`**, a MarkColor
  (`MarkDisplayEncoding`).
- **A mark naming no color paints the display's.** "Naming" is a `value`, a
  `field` or a `scale.type`; a mark's legend title alone names none. A mark
  that names one keeps its own, so a plot of several marks colors each as
  written.
- **One helper decides it**, `paintedColorNode(mark, inherited)`, and every
  reader takes it: `markLayerRequest` and `encodingOf` for the worker,
  `markColorOf` for the main-thread paint and the hides, `keySettingOf` and
  `constantColorOf` for the key, and the text labels' `ownColor`.
- **The rules check the display's color once**, at the display
  (`colorChannelProblems` over `PlotSnapshot.color`), and a mark's own where
  it names one; `jbrowse validate` passes `encoding.color` along.
- Multi-way synteny's lane marks, which have no display color, pass none.

## Consequences

- Edit plot's form edits each mark's own color; the display's shows in Edit
  as JSON.
- `YEncoding` (wiggle-core) is no longer the mark display's encoding.

## Rejected alternatives

- **Rewriting the multi-row configs into `marks`.** Every config, tutorial,
  build script and add-track route changes, and a display-level color is the
  grammar's word for "every layer's" anyway.
- **The subtype mapping its own `encoding.color` onto its rect.** A second
  spelling of a color in one display type, read by one subtype's code.
