---
id: bookmark_widget
title: Bookmark widget
description: Saving and sharing genomic locations
guide_category: Other features
---

The bookmark widget stores genomic regions for easy navigation. Each bookmark is
a single region (chromosome, start, end); clicking one navigates a linear genome
view to it.

<Figure caption="The bookmark widget can be accessed via the Tools menu, or in the view menu 'Bookmarks' submenu." src="/img/bookmark_widget_open.png"/>

The dropdown menu above the table of bookmarks can be used to view a subset of
all assemblies with bookmarks.

Resize the columns of the table by clicking and dragging the grey lines above
the table.

### Creating bookmarks

Bookmarks can be created by clicking and dragging on the top of any linear
genome view and selecting "Bookmark region."

<Figure caption="Create a bookmark by clicking and dragging the top of any LGV and select 'Bookmark region.'" src="/img/bookmark_widget_create.png"/>

#### Keyboard shortcuts

- Create a bookmark: `CTRL/CMD + Shift + D`
- Navigate to the most recently created bookmark: `CTRL/CMD + Shift + M`

### Selecting bookmarks

Use the checkboxes to the left of the table to select bookmarks for bulk export,
sharing, deletion, or editing.

<Figure caption="Select your bookmarks of interest using the left checkboxes." src="/img/bookmark_widget_select.png"/>

### Labels and highlights

Add a label to a bookmarked region by clicking the label field and typing, or
double-clicking to open a dialog. Labels are saved and exported with bookmarks,
and displayed on the LGV via highlights.

<Figure caption="Create a label in the bookmarks widget, and it can be viewed on the LGV." src="/img/bookmark_widget_edit_label.png"/>

#### Highlights

New bookmarks are assigned a highlight color by default. You can change it
directly in the Highlight field, or change multiple bookmarks in bulk via the
hamburger menu → "Edit colors".

<Figure caption="Highlight colors can be modified in the bookmarks widget." src="/img/bookmark_widget_edit_colors.png"/>

Highlights and labels can be toggled app-wide (via "Edit colors" menu) or
per-view (via the view menu → "Bookmarks").

### Sharing bookmarks

Select bookmarks with the checkboxes and click "Share" to get a URL you can send
to collaborators or paste into the Import form
[described below](#importing-bookmarks).

<Figure caption="Bookmarks can be shared using the Share option in the bookmarks widget." src="/img/bookmark_widget_share_dialog.png"/>

### Exporting bookmarks

You can export bookmarks into a list of regions as a BED or TSV file.

<Figure caption="Exporting a list of regions to a TSV file." src="/img/bookmark_widget_export_dialog.png"/>

### Importing bookmarks

You can import bookmarks from a list of regions in a BED or TSV file.

<Figure caption="Importing a list of regions from a BED file." src="/img/bookmark_widget_import_dialog.png"/>

You can also import from a share link generated via the
[Sharing bookmarks](#sharing-bookmarks) section above.

Imported bookmarks are appended to your existing bookmarks.

### Deleting bookmarks

Select bookmarks with the left checkboxes and press "Delete" in the widget menu
to remove them.

### Bookmark persistence

Bookmarks persist in browser localStorage, keyed to the URL JBrowse is hosted
on. Only bookmarks valid for the currently loaded assemblies are shown.
