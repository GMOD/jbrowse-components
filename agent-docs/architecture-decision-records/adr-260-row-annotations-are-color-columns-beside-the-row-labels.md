---
status: Accepted
summary: "`rows.annotations` on `Rows` lists `RowAnnotation` entries, each an 8 px categorical color column beside the row labels keyed by `legend.title`; none on `name` or the `rows.color` field, and one decision over the rows drawn picks the columns, label lines and keys. Amends ADR-207"
---

# ADR-260: Row annotations are color columns beside the row labels

## Status

Accepted (2026-11-09). Amends
[ADR-207](adr-207-a-rows-color-resolves-once-and-shows-beside-its-label.md),
whose "one key" becomes the row color's key followed by one key per
annotation. Builds on
[ADR-160](adr-160-a-rows-color-is-one-categorical-channel-on-the-row-axis.md),
whose `RowColor` channel each annotation's members repeat, and
[ADR-257](adr-257-the-row-axis-owns-its-settings.md), which put the row
axis's settings under `rows` and has members follow capability.

## Context

A row took one color, so a reader could show one row attribute at a time. A
clustered cohort is read against several at once: population, sex and
phenotype beside one dendrogram, as ComplexHeatmap's row annotation, ggtree's
`gheatmap` and IGV's sample-attribute panel draw them. Switching `rows.color`
between attributes shows each in turn and never two against the same
clusters.

Each display also built its own sidebar props object for the export, in
near-identical copies, so a field added to the sidebar meant an edit in every
display and a display that missed it drew a different sidebar on screen than
it exported.

## Decision

- **`rows.annotations` sits on `Rows`, beside `filter`.** It maps row
  attributes to color, so it is on the displays whose rows carry attributes:
  wiggle and multi-wiggle, the variant display, and the mark family (mark,
  multi-row feature, Manhattan). MAF's species rows carry only a label, a
  color and an assembly, so its field-less `RowArrangement` declares none,
  and the multi-way lanes never had it. Like `filter` it names no row, so it
  is outside `ROW_ARRANGEMENT_MEMBERS`: "Reset row order" and a write
  changing `rows.field` keep it.
- **Each entry is a `RowAnnotation`**: `field`, `scale.domain`,
  `scale.range`, `scale.unknown`, the members `RowColor` has, and
  `legend.title`, spelt as `encoding.color`'s legend spells it. A string is
  the field, and a lone field or entry, as `rows.annotations=sex` writes it,
  is a list of one. The scale is the row color's sub-schema
  (`rowColorScaleConfigSchema`) under its own name, so its refusals name
  `rows.annotations.scale`. It reorders no row and paints no mark.
- **An entry needs a field, and not `name`.** `field` has no default. An
  entry with none, or on `name`, which the label already shows, is refused
  as `rows.filter` refuses a row's identity: a load names it once and loads
  without it, a write throws, and `jbrowse validate` reports it (the JSON
  Schema's `requires` and `refuses` for an object entry, the validator's own
  check for a bare string).
- **`legend.title` names the column**: the title of its key and the label
  over its column, word for word, the field capitalised where unset.
- **An entry on the `rows.color` field draws nothing of its own.** The row
  color is that field's column already, with the key that focuses rows and
  the colors `rows.colors` pins, so `rowAnnotationChannels` drops it where it
  drops one on `name`. Where the row color paints no mark and shows only
  beside the label (`rowColorPaintsMarks` false: the variant display, wiggle
  under a score gradient), it is the first column.
- **Categorical only.** Each value of the field takes a color the way
  `rows.color` deals one (`dealValueColors`): listed values take their
  `scale.range` color, the rest a palette first seen first, and the empty
  value none. A row with no value leaves a gap.
- **Each annotation deals from a palette of its own**
  (`annotationPaletteColorAt`), picked by its place in `rows.annotations`
  from a fixed list of the named palettes, wrapping past the last. None is
  tableau10, which the row color deals from
  ([ADR-207](adr-207-a-rows-color-resolves-once-and-shows-beside-its-label.md)),
  so the first values of two columns, or of a column and the row color, are
  never one color. The place is the entry's place in the config list, so a
  column keeps its colors while an earlier entry draws nothing, and the
  same place is its key's id (`rowAnnotationScaleId`), which a dismissed
  legend section is remembered by. An entry's own `scale.domain` and
  `scale.range` still deal first.
- **One decision says which columns draw.** `rowAnnotationColumns`, a stage
  after the rows drawn, keeps each deal that colors one of `sources`, the
  rows left after `filter` and `kept`, while the display's
  `drawsRowAnnotations` hook holds: off with the row labels hidden, in a
  shared panel, and on wiggle wherever `drawsRowLabels` is off, as on one
  row. The columns, the label lines `rowColumnLabels` reserves and the keys
  all read it, so none draws without the others.
- **A pale lap stops short of white, the row color's included.** Past a
  palette's end the hues re-light, deep and then pale, and the pale lap is
  capped at an OKLCH lightness of 0.85. Uncapped, the row palette's pale lap
  of its yellow was `#fffffe` and of its pink `#fff5f6`, which neither a
  column nor a row's line on the paper background can show, so the cap
  changes only colors no reader could see. The karyotype palette, drawn at a
  low alpha, keeps its laps uncapped.
- **A column is 8 px at every row height**, `ROW_SWATCH_WIDTH`, in runs
  (`rowRuns`), and beside one the row color is a column as wide, where alone
  beside the names it stays a 4 px bar. 4 px columns were too thin to read
  against a row of text in the 1000 Genomes capture. The labels cover the
  first region's data (the header comment in `RowLabelsOverlay.tsx`), so
  every px of sidebar is a px of plot hidden, and a fixed width keeps the
  cost a reader can count.
- **Two or more color columns take a label each**, the row color's bar or
  swatch counted first where a row has one: one line of text per column
  stacked above the first row, the first column's on top, a 1 px leader
  dropping from each line to its column's center, and every label starting
  right of the last leader (`SvgRowColumnLabels`). A lone column takes none,
  since its key's title names it.
- **The labels cost height, not width.** `rowsTopOffset` adds a line per
  label (`rowsLeadHeight`, the focus chip's line and then these), so the
  rows, the dendrogram, the band strip, the separators, the hit tests and the
  export all start under them, as they start under the chip's line. The
  lines do not scroll, and the export keeps them while it drops the chip's
  line. A long label runs right over the blank lines above the rows.
- **Each drawn annotation has a key**, appended to `rowColorScales` after
  the row color's. Its entries name colors and focus no rows, so it lists
  only the values the rows drawn carry. The row color's key keeps every
  value, since its entries focus rows and a focus must be able to reach one
  not drawn. The row color's key is found by `ROW_COLOR_SCALE_ID`, never by
  position.
- **What draws nothing says so, and nothing else changes.**
  `rowAnnotationNotices` puts three lines in the display's notice: an entry
  on a field no row carries, one on numbers that are mostly distinct (each
  dealt a color, where a continuous scale is not supported), and column
  labels taking over half the track. They read the loaded rows and the
  track height, so `jbrowse validate`, which has neither, does not report
  them, as it does not report the `facet.field` and `rows.filter` row
  notices. No option is added for any of them.
- **No UI yet.** A config, a session spec and launch args set it. The
  arrangement dialog shows `rows.color` alone.
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
- A narrowing that leaves no drawn row with an annotation's value drops its
  column, its label line and its key together, and brings them back with
  the rows.
- The okabeIto palette's own yellow is the lightest color an annotation
  deals, about 1.3:1 on white.
- Some row colors past the 18th value, the light hues' pale lap, are darker
  than before the cap, in a figure as in the app.
- A capture run's `window.jbrowseRowPalette` replaces the row palette alone.
- Below the text threshold a track with annotations and no row color draws its
  columns from the left edge, inside the 8 px the swatch would take.
- A mark display over a multi-BigWig draws no annotation from a subtrack's
  `group` or a samples table column, since the row listing it reads carries
  neither (`ready/a-row-listing-carries-its-rows-attributes.md`).
- The variants tables export still carries the row color and its key alone.
- The static hosts install `rowSidebarProps`, so an export with no session
  draws the columns too.

## Rejected

- **`attributes` as the name.** It names the data, not the mark drawn from
  it; the row attributes are the samples table's columns, which a
  `rows.filter`, a facet and a tooltip read as well.
- **`strips` as the name, or `rows.axis.strips`.** The band label beside the
  tree is the strip
  ([ADR-169](adr-169-a-band-draws-the-clade-of-its-rows.md)), and under
  `axis` it files data under how the axis draws.
- **`sideColors`.** A clustermap's word for the same picture, but it says
  where the colors sit rather than what they show, and ComplexHeatmap's row
  annotation is the closer grammar.
- **Making `rows.color` a list.** The first entry would also paint the marks
  and focus rows from its key while the rest would not, one member with two
  meanings.
- **An entry that defaults to `name`, drawing nothing.** A `RowColor` as the
  entry gave every annotation `name` by default, so a missing field loaded
  silently as a column that never drew.
- **Drawing an annotation on the `rows.color` field.** The same attribute
  twice, in two palettes, one of whose keys focuses rows and one not.
- **Wider columns with rotated headers.** A header a reader can read needs
  about 12 px of column pitch, three times a column's width, and every px of
  sidebar hides a px of the first region.
- **A toggle for the labels.** Two unnamed columns are unreadable, and the
  cost is a text line each.
- **A hover tooltip as the only naming.** A figure and an export have no
  hover, and the sidebar passes its pointer events to the plot under it.
- **One shared palette.** Every key then starts on the same blue and orange,
  so a color names no column: in 1000 Genomes EUR, GBR and male were one
  blue.
- **A `width` option.** A default nobody should have to tune, and a wide
  column hides more of the first region.
- **A 4 px column.** As thin as the row color's bar, and too thin to read
  as its own column of values beside the names.
- **One shared `legend.title` for the annotations.** Each column is a
  different attribute, so each entry titles its own.
- **A sequential ramp.** A quantitative row attribute needs a scale type, a
  domain and a ramp key, none of which the entry has; the notice names a
  field that wants one.
- **Storing the colors on the row.** A row has two colors, its own and the
  resolved one; the columns are a map by row name beside the rows, so an
  annotation changes no row.
- **A line per display.** Adding `annotations` to each hand-built sidebar
  object leaves the next field with the same edits to make and the same
  display to miss.
