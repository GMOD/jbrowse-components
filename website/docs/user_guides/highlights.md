---
title: Highlights
description: Marking genomic regions and returning to them
guide_category: General usage
---

A highlight is a translucent band over a genomic region. Every linear genome
view (LGV) and dotplot showing the region's assembly draws it, and the session
saves it, so a shared link carries it. The highlight list, opened from **Tools →
Highlights** or a view's **Highlights** menu, holds every highlight with a link
back to it.

## Making a highlight

- Drag across the scalebar at the top of an LGV and pick **Highlight region**.
- On a dotplot, drag a rectangle and pick **Highlight region**: the horizontal
  span bands the horizontal axis and the vertical span the vertical one.
- Press `Ctrl`/`Cmd` + `Shift` + `D`, or pick **Highlights → Highlight current
  region** in the view menu, to highlight the region in view.
- Put [`&highlight=`](/docs/urlparams#highlight) in a URL, or `highlight` on a
  view in a session spec.
- Import a BED or TSV file from the highlight list's menu.

<Figure caption="Drag across the top of an LGV and pick 'Highlight region.'" src="/img/highlight_list_create.png"/>

<Video src="/media/ui/highlight_region.mp4" caption="A span of PTEN selected on the scalebar and highlighted, the highlight list opened from the view menu, the row named, and the view sent elsewhere on chr10 before the row's link brings it back to the highlighted span." />

## The highlight list

- The link in the Location column navigates the focused LGV on that assembly, or
  opens one, zoomed out a little for context. `Ctrl`/`Cmd` + `Shift` + `M`
  navigates to the newest highlight.
- Click a Label cell and type to name a highlight. **Highlights → Toggle
  labels** in the view menu shows or hides the names on the bands.
- The Color column sets a band's color. Tick rows to recolor or delete several
  at once.
- The list shows the highlights on an assembly some open view is showing, and
  says how many others it is hiding.

<Figure caption="A label typed into the highlight list names the band on the LGV." src="/img/highlight_list_edit_label.png"/>

## Showing and hiding

**Highlights → Toggle highlights** in a view's menu, or **Show highlights on
views** in the list's menu, hides or shows the bands in every view at once.
Making or recoloring a highlight shows them again.

## Removing

A band's chip menu has **Dismiss highlight**. In the list, tick rows and press
the delete icon.

## Export and import

Export writes the ticked highlights, or every listed one, as BED (one file per
assembly, 0-based starts) or TSV (one file with an `assembly_name` column,
1-based starts). Import reads either and adds to the list; a BED file takes the
assembly picked in the dialog.
