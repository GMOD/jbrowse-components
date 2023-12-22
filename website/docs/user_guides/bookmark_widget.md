---
id: bookmark_widget
title: Bookmark widget
---

import Figure from '../figure'

The "bookmark widget" can store lists of interesting regions that you might like
to easily revisit.

<Figure caption="The bookmark widget can be accessed via the Tools menu, or in the view menu 'Bookmarks' submenu." src="/img/bookmark_widget_open.png"/>

The bookmark widget stores a list of single regions (chromosome, start, and end
coordinate), and clicking on the regions in the bookmark widget will launch a
linear genome view at that region.

The dropdown menu above the table of bookmarks can be used to view a subset of
all assemblies with bookmarks.

Resize the columns of the table by clicking and dragging the grey lines above
the table.

### Creating bookmarks

Bookmarks can be created by clicking and dragging on the top of any linear
genome view and selecting "Bookmark region."

<Figure caption="Create a bookmark by clicking and dragging the top of any LGV and select 'Bookmark region.'" src="/img/bookmark_widget_create.png"/>

#### Hotkeys

There are hotkeys available for navigating bookmarks, including:

- Create a bookmark with `CTRL/CMD + Shift + D`

- Navigate to the most recently created bookmark with `CTRL/CMD + Shift + M`

### Selecting bookmarks

Bookmarks can be selected using the checkboxes to the left of the table of
bookmarks.

Selected bookmarks can be bulk exported, shared, deleted, or edited.

<Figure caption="Select your bookmarks of interest using the left checkboxes." src="/img/bookmark_widget_select.png"/>

### Labels and highlights

You can add labels/notes/annotations/remarks on a bookmarked region by single
clicking, then typing in the field, or by double clicking on the field, then
typing in the dialog.

<Figure caption="Create a label in the bookmarks widget, and it can be viewed on the LGV." src="/img/bookmark_widget_edit_label.png"/>

Labels are saved and exported with your bookmarks.

Labels can be viewed directly on the LGV via the highlight feature.

#### Highlights

By default, a color will be assigned to a new bookmark, "highlighting" the
region.

The color assigned to the bookmark can be modified in the bookmarks widget
either directly on the Highlight field, or in bulk by selecting bookmarks with
the left-oriented checkboxes and then selecting the "Edit colors" menu within
the left hamburger menu at the top of the widget.

<Figure caption="Highlight colors can be modified in the bookmarks widget." src="/img/bookmark_widget_edit_colors.png"/>

You can optionally disable viewing the highlights on your linear genome view
either app-wide using the "highlight toggles" in the "Edit colors" menu at the
top of the bookmarks widget, or view-specific using the view menu options under
"Bookmarks." You can do the same for labels.

### Sharing bookmarks

You can share your bookmarks with collaborators or other systems using the
"Share" button in the bookmarks widget menu.

Select bookmarks you wish to share by clicking on the checkboxes to the left of
the list of bookmarks.

A modal will provide you with a URL that you can copy and share with others to
be pasted within the appropriate filed in the "Import" form
[detailed below](#importing-bookmarks).

<Figure caption="Bookmarks can be shared using the Share option in the bookmarks widget." src="/img/bookmark_widget_share_dialog.png"/>

### Exporting bookmarks

You can export bookmarks into a list of regions as a BED or TSV file.

<Figure caption="Exporting a list of regions to a TSV file." src="/img/bookmark_widget_export_dialog.png"/>

### Importing bookmarks

You can import bookmarks from a list of regions in a BED or TSV file.

<Figure caption="Importing a list of regions from a BED file." src="/img/bookmark_widget_import_dialog.png"/>

You can also import bookmarks from a share link provided from another system.
The appropriate share link is one generated from the
[routine detailed above](#sharing-bookmarks).

Imported bookmarks are appended to your existing bookmarks.

### Deleting bookmarks

Bookmarks can be removed from your system by selecting them using the left
checkboxes, then pressing the "Delete" button within the Bookmarks widget
menu.bookmark

### Bookmark persistence

Bookmarks are saved and loaded from your localStorage, and reference the URL
that JBrowse is being hosted on to determine which bookmarks to retrieve.

Note that only bookmarks that are valid for the presently loaded assemblies will
be displayed.
