---
title: Bookmark widget
description: Saving and sharing genomic locations
guide_category: Other features
---

The bookmark widget stores genomic regions for easy navigation. Each bookmark is
a single region (chromosome, start, end); clicking one navigates a linear genome
view (LGV) to it.

In the bookmark table, the dropdown menu above the table filters bookmarks by
assembly, and the columns can be resized by dragging the grey divider lines.

## Creating bookmarks

Bookmarks can be created by clicking and dragging on the top of any linear
genome view and selecting "Bookmark region."

<Figure caption="Create a bookmark by clicking and dragging the top of any LGV and selecting 'Bookmark region.'" src="/img/bookmark_widget_create.png"/>

### Keyboard shortcuts

- Create a bookmark: `Ctrl`/`Cmd` + `Shift` + `D`
- Navigate to the most recently created bookmark: `Ctrl`/`Cmd` + `Shift` + `M`

## Selecting bookmarks

Use the checkboxes to the left of the table to select bookmarks for bulk export,
sharing, deletion, or editing.

## Labels and highlights

Add a label to a bookmarked region by clicking the label field and typing, or
double-clicking to open a dialog. Labels are saved and exported with bookmarks,
and displayed on the LGV via highlights.

<Figure caption="Create a label in the bookmarks widget, and it can be viewed on the LGV." src="/img/bookmark_widget_edit_label.png"/>

### Highlights

New bookmarks are assigned a highlight color by default. You can change it
directly in the Highlight field, or change multiple bookmarks in bulk via the
"Edit colors" option in the bookmark widget's menu.

Highlights and labels can be toggled app-wide (via the "Edit colors" dialog) or
per-view (via a view's "Bookmarks" menu).

## Importing and exporting

Export bookmarks to a list of regions as a BED or TSV file, or import them from
the same formats. Imported bookmarks are appended to your existing bookmarks.

## Deleting bookmarks

Select bookmarks (see [Selecting bookmarks](#selecting-bookmarks)) and press
"Delete" in the widget menu to remove them.

## Bookmark persistence

Bookmarks persist in browser localStorage, keyed to the URL JBrowse is hosted
on. Only bookmarks valid for the currently loaded assemblies are shown.

## See also

- [Basic usage: sharing sessions](/docs/user_guides/basic_usage#sharing-sessions)
- [Basic usage: rubberband selection](/docs/user_guides/basic_usage#rubberband-selection)
