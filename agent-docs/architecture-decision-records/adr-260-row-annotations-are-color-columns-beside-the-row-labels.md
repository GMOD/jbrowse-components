---
status: Accepted
summary: "`rows.annotations` on every row display is a list of `RowColor` channels, each drawn as a fixed 4 px categorical color column beside the row labels with a key of its own; `TreeSidebarMixin.rowSidebarProps` states the sidebar once for the screen, the axis and the export. Amends ADR-207's one key"
---

# ADR-260: Row annotations are color columns beside the row labels

## Status

Accepted (2026-11-09). Amends
[ADR-207](adr-207-a-rows-color-resolves-once-and-shows-beside-its-label.md),
whose "one key" becomes the row color's key followed by one key per
annotation. Builds on
[ADR-160](adr-160-a-rows-color-is-one-categorical-channel-on-the-row-axis.md),
whose `RowColor` channel each annotation is, and
[ADR-257](adr-257-the-row-axis-owns-its-settings.md), which put the row
axis's settings under `rows`.

## Context

A row took one color, so a reader could show one row attribute at a time. A
clustered cohort is read against several at once: population, sex and
phenotype beside one dendrogram, as ComplexHeatmap's row annotation and
ggtree's `gheatmap` draw them. Switching `rows.color` between attributes
shows each in turn and never two against the same clusters.

Each display also built its own sidebar props object for the export, in
near-identical copies, so a field added to the sidebar meant an edit in every
display and a display that missed it drew a different sidebar on screen than
it exported.

## Decision

- **`rows.annotations` is a list of `RowColor` channels**, each a field or
  `{ field, scale: { domain, range, unknown } }`, drawn in the order listed
  after the row's own color. It reorders no row and paints no mark.
- **It sits on `rows` beside `color` and `colors`**, since it maps row
  attributes to color as they do. `rows.axis` says how the axis draws (tree,
  labels, width, grid), not what data the rows show. Like `color` it names no
  row, so it is outside `ROW_ARRANGEMENT_MEMBERS`: "Reset row order" and a
  write changing `rows.field` keep it.
- **"Annotations", not "strip".** The band label beside the tree is the strip
  ([ADR-169](adr-169-a-band-draws-the-clade-of-its-rows.md)), and
  ComplexHeatmap's name for this is the row annotation.
- **Categorical only.** Each value of the field takes a color the way
  `rows.color` deals one (`dealtValueColorsFor`): listed values take their
  `scale.range` color, the rest the row palette first seen first, and the
  empty value none. A row with no value leaves a gap, and a field no row
  carries draws no column and no key.
- **A column is 4 px at every row height**, `ROW_COLOR_BAR_WIDTH`, in runs
  (`rowRuns`). The labels cover the first region's data (the header comment
  in `RowLabelsOverlay.tsx`), so every px of sidebar is a px of plot hidden,
  and a fixed width keeps the cost a reader can count.
- **Each annotation has a key**, appended to `rowColorScales` after the row
  color's, titled by its field. Its entries name colors and focus no rows.
  The row color's key is found by `ROW_COLOR_SCALE_ID`, never by position.
- **No UI yet.** A config, a session spec and launch args set it; a lone
  field or channel, as `rows.annotations=sex` writes it, is a list of one.
  The arrangement dialog shows `rows.color` alone.
- **A column and its key show together or not at all.** The columns draw
  beside the row labels, so with the labels hidden (`rows.axis.labels`) or in
  a shared panel, which stacks no rows, the mixin reads no annotation: no
  column, no deal and no key.
- **The mixin states the sidebar once.** `rowSidebarProps` is the tree, the
  band strip, the labels and the annotation columns from the settings and the
  rows drawn. A display's `svgSidebar` is that getter or a spread of it with
  the display's one difference: wiggle's `showLabels` (an overlay names no
  row), the mark display's `drawsRows` gate, and the axis gutter as
  `leftInset`. `RowsPanel` and wiggle's row labels pass the same columns, so
  the labels on screen, the y axis's `left` and the export gutter are one
  width.

## Consequences

- A track with several annotations shows several keys in its legend.
- Below the text threshold a track with annotations and no row color draws its
  columns from the left edge, inside the 8 px the swatch would take.
- An annotation on `name`, the default field, draws nothing whatever its
  scale, since the labels already show the name; it is not refused.
- The variants tables export still carries the row color and its key alone.
- The static hosts install `rowSidebarProps`, so an export with no session
  draws the columns too.

## Rejected

- **A `width` option.** A default nobody should have to tune, and a wide
  column hides more of the first region.
- **A wider column at sub-pixel rows.** The 8 px swatch there stands in for a
  label that cannot draw; several columns read as a heatmap at 4 px, and at 8
  each would double the plot they hide.
- **A shared `legend.title` for the annotations.** Each column is a different
  attribute, and its field is its title.
- **A sequential ramp.** A quantitative row attribute needs a scale type, a
  domain and a ramp key, none of which `RowColor` has.
- **Storing the colors on the row.** A row has two colors, its own and the
  resolved one; the columns are a map by row name beside the rows, so an
  annotation changes no row.
- **`rows.axis.strips`.** It files data under how the axis draws, and "strip"
  is the band label.
- **Making `rows.color` a list.** The first entry would also paint the marks
  and focus rows from its key while the rest would not, one member with two
  meanings.
- **A line per display.** Adding `annotations` to each hand-built sidebar
  object leaves the next field with the same edits to make and the same
  display to miss.
