---
name: the-dotplot-controls-could-be-redesigned
description: The dotplot header is six buttons and a coordinate readout, and its ⋮ "Zoom and layout options" menu holds zoom, aspect and chromosome-order items next to a view menu that repeats the track selector. This inventories both and the questions any redesign has to answer; it proposes no design.
---

# The dotplot controls could be redesigned

The maintainer, on the dotplot card: "could consider radical new designs also".
This records what is there, so a redesign starts from the whole of it. It
proposes nothing.

## Today's header

`DotplotControls.tsx`, left to right, then `Header.tsx`'s readout:

- **Open track selector**: icon button, only when the session has widgets.
- **Zoom out** and **Zoom in**: icon buttons, `model.zoomOut()` and
  `model.zoomIn()`.
- **Cursor mode**: one icon button that flips between pan (`move`) and region
  select (`crosshair`); its title names the other mode. The choice persists in
  localStorage (`LS_CURSOR_MODE`).
- **⋮ Zoom and layout options** (`dotplot_view_menu`): see below.
- **Color by** (`ColorBySelector`, shared with the synteny view): a palette
  button over `colorByMenuItems`.
- **Settings** (`DotplotSettingsMenu`, a Tune icon, only once a display
  exists): identity fade, CIGAR indels, gridlines, tick labels, legend, level
  of detail, opacity, line width, minimum length, minimum identity.
- The x and y readout of assembly names and visible bp, a selection width and
  height while dragging, then the track warnings button at the right edge.

## Today's ⋮ menu

In order:

- **Square view - same bp per pixel** and **Rectangular view - same total bp**,
  shown only while the aspect lock is off.
- **Zoom out fully**: every assembly whole.
- **Re-order chromosomes...**: opens a dialog; shared with the synteny view.
- **Lock aspect ratio (same bp/px)**: a checkbox on `model.ratio === 1`. An
  autorun squares the axes when it goes on.

The menu mixes three things: one-shot zooms (the first three), a one-shot
data operation (re-order), and a persistent mode (the lock). Two of the zoom
items appear and disappear with the lock.

## What overlaps the view menu

The view's own menu (`model.menuItems()`, the title bar's ⋮) holds:

- **Return to import form** and **Export image...**
- **Open track selector**, which the header button also opens.
- **Open in circular synteny view**, when the circular view is installed.
- **Show highlights**, a session-wide checkbox.

Overlaps and neighbours:

- Open track selector is in both places.
- Zoom in, zoom out and Zoom out fully are three spellings of zoom, split
  between the header and the ⋮ menu; the wheel and drag-select are a fourth and
  fifth, and the cursor-mode button decides which of drag and select the plain
  drag does.
- Re-order chromosomes changes the data's arrangement, which the view menu's
  import and export items sit nearer to than the ⋮ menu's zooms do.
- The ⋮ menu's name, "Zoom and layout options", is the only label that says
  what lives there, and the Settings icon's tooltip is separate from it. A user
  looking for "line width" or "lock aspect" has two plausible menus.

## Questions a redesign must answer

- **What is a mode and what is an action?** The cursor mode and the aspect lock
  are modes; the zooms and re-order are actions. Today a mode sits in the
  header and another in a menu.
- **Which controls must be one click?** Zoom and cursor mode are used
  continuously; the square and rectangular views and Zoom out fully are not.
- **Where do per-axis things go?** Every control acts on both axes at once.
  Nothing in the header addresses the x assembly or the y assembly separately,
  though the readout names them.
- **Where does the readout belong?** It is text next to buttons, and doubles as
  the only place the selection size shows.
- **One menu or two for the plot's appearance and layout?** Gridlines, tick
  labels and legend are appearance; aspect lock and squaring are layout.
  Anything that merges the ⋮ and Settings menus also touches the shared
  `SETTINGS_SURFACE_LABELS` and the synteny view's matching settings menu.
- **How much does it share with the synteny view?** Color by, Re-order and the
  settings items are shared code. A dotplot-only redesign forks them or moves
  both views.
- **Does the track selector button stay in the header** when the view menu
  already opens it?
- **Which tests and docs name today's controls?** `DotplotControls.test.tsx`,
  `DotplotSettingsMenu.test.tsx`, the `dotplot_view_menu` and `color_by_menu`
  test ids that browser tests and captures use, and the user guide's dotplot
  page.
