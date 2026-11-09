---
status: Accepted
summary: "`rows.annotations` on every row display is a list of `RowColor` channels, each drawn as a fixed 4 px categorical color column beside the row labels with a key and a palette of its own, and two or more color columns take a stair-step label each above the rows; `TreeSidebarMixin.rowSidebarProps` states the sidebar once for the screen, the axis and the export. Amends ADR-207's one key"
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
  `scale.range` color, the rest a palette first seen first, and the
  empty value none. A row with no value leaves a gap, and a field no row
  carries draws no column and no key.
- **Each annotation deals from a palette of its own**
  (`annotationPaletteColorAt`), picked by its place in `rows.annotations`
  from a fixed list of the named palettes, wrapping past the last. None is
  tableau10, which the row color deals from
  ([ADR-207](adr-207-a-rows-color-resolves-once-and-shows-beside-its-label.md)),
  so the first values of two columns, or of a column and the row color, are
  never one color. The place is the entry's place in the config list, so a
  column keeps its colors while an earlier entry draws nothing. An entry's
  own `scale.domain` and `scale.range` still deal first.
- **An annotation's pale lap stops short of white.** Past a palette's end
  the hues re-light as the row palette's do, deep and then pale, and the pale
  lap is capped at an OKLCH lightness of 0.85. The row palette's pale lap of
  its yellow is `#fffffe` and of its pink `#fff5f6`, which a 4 px column on
  the paper background cannot show. The row color's own deal is unchanged.
- **A column is 4 px at every row height**, `ROW_COLOR_BAR_WIDTH`, in runs
  (`rowRuns`). The labels cover the first region's data (the header comment
  in `RowLabelsOverlay.tsx`), so every px of sidebar is a px of plot hidden,
  and a fixed width keeps the cost a reader can count.
- **Two or more color columns take a label each**, the row color's bar or
  swatch counted first where a row has one: one line of text per column
  stacked above the first row, the first column's on top, a 1 px leader
  dropping from each line to its column's center, and every label starting
  right of the last leader (`SvgRowColumnLabels`). The label is the title of
  the column's key (`rowColorTitle`, `rowAnnotationTitle`), word for word. A
  lone column takes none, since its key's title names it.
- **The labels cost height, not width.** The mixin's `rowColumnLabels` lists
  them and `rowsTopOffset` adds a line each (`rowsLeadHeight`, the focus
  chip's line and then these), so the rows, the dendrogram, the band strip,
  the separators, the hit tests and the export all start under them, as they
  start under the chip's line. The lines do not scroll, and the export keeps
  them while it drops the chip's line. The label box is no wider, and a long
  label runs right over the blank lines above the rows.
- **Stair-step rather than rotated headers.** Rotated text needs about 12 px
  of pitch per column, three times a column's width, and the labels cover
  the first region's data, so width is the cost to avoid.
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
- A track with two or more color columns gives a text line per column to the
  labels, inside its height, so fitted rows are that much shorter.
- A wiggle track drawing one row, which names no row, reserves the lines and
  draws no label.
- The okabeIto palette's own yellow is the lightest color an annotation
  deals, about 1.3:1 on white.
- A capture run's `window.jbrowseRowPalette` replaces the row palette alone.
- Below the text threshold a track with annotations and no row color draws its
  columns from the left edge, inside the 8 px the swatch would take.
- An annotation on `name`, the default field, draws nothing whatever its
  scale, since the labels already show the name; it is not refused.
- The variants tables export still carries the row color and its key alone.
- The static hosts install `rowSidebarProps`, so an export with no session
  draws the columns too.

## Rejected

- **Wider columns with rotated headers.** A header a reader can read needs
  about 12 px of column pitch, and every px of sidebar hides a px of the
  first region.
- **A toggle for the labels.** Two unnamed columns are unreadable, and the
  cost is a text line each.
- **A hover tooltip as the only naming.** A figure and an export have no
  hover, and the sidebar passes its pointer events to the plot under it.
- **One shared palette.** Every key then starts on the same blue and orange,
  so a color names no column: in 1000 Genomes EUR, GBR and male were one
  blue.
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
