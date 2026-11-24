---
status: Accepted
summary: "Facet filters are a chip row under the track selector's filter box in both modes, replacing the panel; one table state per selector holds facets, sort and columns, and the tree shows only the tracks they keep"
---

# ADR-271: The track filters are chips the tree and the table share

## Status

Accepted (2026-11-17). Colin picked the chip row over a Filters button and
side panel from captures of both in the drawer (a 293-track ENCODE-style list
at 1280 and 1920 px), asked for it in the tree too, and asked that the table
read as a mode of the track selector rather than a separate faceted selector.

Amended 2026-11-17: the ☰ menu was a grab-bag, so its rows that act on part
of the tree move to where they act, and it keeps only the panel's actions and
the table's rows (One header, below). The tree's Sort toggles are deleted with
their state: they kept the choice under bare `sortTrackNames` /
`sortCategories` localStorage keys that won over `hierarchical.sort.*`, so a
choice made once overrode every config on the origin, a hub's included. The
tree's order is now the config's alone, and the table's column headers are the
interactive sort; the tree does not follow the table's sort.

Amended 2026-11-18, after Colin judged seven prototypes on hg38 from today
and proposal captures side by side:

- The add-to-selection mode went. A ☰ checkbox turned every row checkbox from
  "shown" into "selected", so one control meant two things. A table checkbox
  now always shows or hides its track, and Ctrl/Cmd-click on a name selects,
  as in the tree.
- The header checkbox shows or hides every track the filter kept, and appears
  only while a query or chip narrows the list, beside "N of M". While the list
  is narrowed the ☰ also offers "Add matching tracks to selection", so a
  filtered set still reaches the cart's "Create multi-row track".
- The tree has no category chip unless a category filter is set, since its
  headings are its category facet.
- Rows indent by how many drawn rows they sit under, so Favorites and Recent
  start at the left edge.

Amended 2026-11-20: a table row answers a click as a tree row does. Colin found
the table's checkboxes showed no pointer and its names ignored a plain click.
The name is a label for its row's checkbox, so a click on it shows or hides the
track; the two modes share the Ctrl/Cmd-click handler, the hover and selection
tints, and one checkbox glyph, the header's mixed state included. A table
row's checkbox also shows its track through the tree row's call, which records
it in Recent only once it shows; the table's show-all and a category's Show
all record nothing, since Recent keeps ten tracks and one bulk show would push
out every track picked by hand.

Amended 2026-11-20, after a review of captures on the hosted hg38 hub: a tree
the filter empties says "No tracks match the current search and filters" in the
table's words, where it used to draw a blank panel, and an empty Favorites or
Recent list says so where the rows go, as the table does, so the filter row no
longer drops when the list changes. A group row still shows over an emptied
list, since a dormant connection loads from it, so the line appears only when
the tree would draw nothing. A filter chip whose facet has no value left opens
on "No matching values". Every search box shows its clear button only while
there is text, and keeps the button's room so the box does not change height.

Amended 2026-11-23: the tree's filter box matches metadata values too, so a
query finds the same tracks in Tree mode as in Table mode, less the kind and
adapter (#1708). A row kept for text it does not draw names that text after its
name in grey, as `biosample: K562`, or as the description's text alone, since
the row's tooltip already shows the description and a label would take the
room a long name leaves, and only while a query is set; in Favorites and Recent, which draw no folders, a
category hit is named as `category: …`. A value whose term sits past its first
12 characters starts at the word holding it, or at the term inside a long word
such as a URL, after an ellipsis, since the row is cut at its end; a value is
named as the plain text its table cell shows. An excluded term hides a track for a
value the row does not draw, as the table already did. A typed `field:value` is
still a literal term: it waits on the filter predicates in
`waiting-on-a-call/the-track-list-config-speaks-the-grammar.md`.

Amended 2026-11-24: the config's own tracks draw their "Tracks" group row even
with no connection. Without it a track with no category, such as Reference
sequence, sat loose above the first category bar on hosted hg38 (Colin), and
the group row's menu already carried Collapse / Expand all categories.

## Context

ADR-269 left the facet panel off in the drawer, reachable only through "Show
facet filters" in the table's ⋮ menu, so users could not find it. Opened, the
200 px panel cost the table a column in a 1280 px window and cut names in the
middle. With the panel closed after filtering, the table stayed filtered and
only "13 of 294" said so. The table built its own faceted model on every Tree
→ Table toggle, seeded with the tree's query, so its facets and sort were lost
on the way back, and the tree could not filter by metadata at all.

## Decision

- **The facet filters are chips under the filter box.** The facets ADR-269
  opens first get a chip each, and the rest sit behind "More filters". A chip
  opens its facet's values with their counts; an active chip names its
  selection ("biosample: K562 +1") and clears with its ×, so a filter is
  never hidden. A facet with no values gets no chip, and a list with no field
  that groups tracks gets no row.
- **The tree and the table share one table state.** The track selector
  creates it on attach (`trackTable`) and destroys it with itself. Its search
  text is the selector's `filterText`, so one filter box serves both modes,
  and the tree keeps a track only when it is in the table's `keptIds`.
  The tree matches the text against a track's name, categories, description
  and metadata values, and the table also its kind and adapter, so "N of M" is
  the open mode's count. Facets and sort survive a Tree |
  Table toggle.
- **One header.** The drawer's table draws the tree's header (☰, cart,
  filter box, chips). Amended 2026-11-17, the ☰ menu's rows went to:
  - Add track... and Add connection...: stay in the ☰, which draws nothing
    when it would be empty. The floating add FAB went.
  - Clear favorites / Clear recently used: stay in the ☰, only while that
    list shows and has tracks; a text button beside the toggles does not fit
    the 384 px drawer without a second line. Clear favorites offers Undo.
  - Delete connections...: "Delete connection..." on the connection's own
    group row, through the same confirm.
  - Collapse: "Collapse all categories" / "Expand all categories" on a group
    row's menu, which drops "Open
    as table..." for the Tree | Table toggle; config `defaultCollapsed.*`
    still sets the first load.
  - Sort: deleted (Status).
  - Add matching tracks to selection (while the list is narrowed) and
    Manage columns: the ☰'s last rows in table mode, so the mode adds no
    icon; the folder dialog, with no ☰, has a columns button where its ⋮
    was. A 32 px menu column at the end of the table's header row was tried
    and dropped: it cost every row a blank cell and the columns width in a
    narrow drawer.
  - The toolbar reads ☰, cart (while something is selected), filter box,
    with nothing after the filter box. A + button holding the add and clear
    rows was tried in the ☰'s place and then after the filter box: at the
    head of "Filter tracks" it read as "add a filter", and without the ☰ the
    row looked bare on the left. A separate columns button in table mode
    was a second icon for one mode.
- **A folder dialog keeps a table of its own** (`useTrackTable`), with its
  own filter box and the same chips, since `TrackSelector-folderDialog` is a
  documented extension point.

## Rejected alternatives

| Alternative | Why |
| --- | --- |
| A Filters toggle button with a side panel that opens when the table has room | The panel cost a column in the usual drawer width, and closed it hid an active filter behind a count |
| Keeping the side panel for the wide folder dialog | Two filter mechanisms for one table |
| Column-header filter popovers | Found only by hovering a header, and the tree has no headers |
| The tree matching text against metadata with nothing on the row saying why | A track kept for a value it does not draw reads as a wrong match. Superseded 2026-11-23: the tree matches metadata and names the hit after the track's name |
| A hint guaranteed 90 or 120 px while a query is set, the name cut at its end to make room | Tried 2026-11-23 on hosted hg38 (`rna`, `splicing`, `difficult`, `chicken`) and an ENCODE-style hub at 384 and 500 px: with the description unlabeled, every hinted row already showed its term, and the floor only cut names that fit. A long name hides the hint only for a description-only hit on about 42 hg38 tracks of 40+ characters, mostly conservation tracks (`mammals`, `primates`) |
| Folding the folder dialog into table mode with a category chip | Breaks the `TrackSelector-folderDialog` extension point |
| An add-to-selection mode for the table's checkboxes | One checkbox meant two things, switched from a menu; Ctrl/Cmd-click and "Add matching tracks to selection" select without it (2026-11-18) |
| A show-all header checkbox on an unfiltered list | One stray click turned on every track of a hub; it appears with "N of M" |
| A track's ⋯ shown only on hover | Colin wants it always on (2026-11-18); a new user should see that a row has a menu |
| "1 shown" at the right of a closed category whose tracks are on | Built and declined from today/proposal captures on hg38, where the one shown track sat inside a closed bar (Colin, 2026-11-20) |
| No "Tracks" row when the config's tracks are the only group | Built 2026-11-18 and reverted 2026-11-24: an uncategorized track read as orphaned above the teal category bars (Colin) |
| The drawer's table without its outline and the rule under each row | Declined from the same captures; Colin asked for less wasted width instead, and the checkbox column of every table went from 40 px to 28 |

## Consequences

- The panel width, `MIN_PANEL_WIDTH`, `clearFilters` and the
  `facet-showFilters`/`facet-panelWidth` localStorage keys are gone.
