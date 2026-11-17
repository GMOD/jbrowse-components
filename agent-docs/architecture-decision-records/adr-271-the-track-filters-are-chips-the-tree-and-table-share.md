---
status: Accepted
summary: "The track selector's facet filters are a row of chips under its filter box, shown in tree and table mode alike; one table state per selector holds the facets, sort and columns and reads the selector's filter box, and the tree shows only the tracks its facets keep. The side facet panel and its toggle go"
---

# ADR-271: The track filters are chips the tree and the table share

## Status

Accepted (2026-11-17). Colin picked the chip row over a Filters button and
side panel from captures of both in the drawer (a 293-track ENCODE-style list
at 1280 and 1920 px), asked for it in the tree too, and asked that the table
read as a mode of the track selector rather than a separate faceted selector.

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
  and the tree keeps a track only when it is in the table's `facetKeptIds`.
  Each mode still matches the text against what it shows: the tree its name,
  categories and description, the table also its kind, adapter and metadata,
  so "N of M" is the open mode's count. Facets, sort and add-to-selection mode
  survive a Tree | Table toggle.
- **One header.** The drawer's table draws the tree's header (☰ menu, cart,
  filter box, chips); in table mode the ☰ menu's Sort and Collapse rows give
  way to "Add tracks to selection…" and Manage columns.
- **A folder dialog keeps a table of its own** (`useFacetedModel`), with its
  own filter box and the same chips, since `TrackSelector-folderDialog` is a
  documented extension point.

## Rejected alternatives

| Alternative | Why |
| --- | --- |
| A Filters toggle button with a side panel that opens when the table has room | The panel cost a column in the usual drawer width, and closed it hid an active filter behind a count |
| Keeping the side panel for the wide folder dialog | Two filter mechanisms for one table |
| Column-header filter popovers | Found only by hovering a header, and the tree has no headers |
| The tree matching text against the table's rows (kind, adapter, metadata) | The filter box searches what the tree shows; a track kept for a hidden metadata value reads as a wrong match. The chips are how the tree filters on metadata |
| Folding the folder dialog into table mode with a category chip | Breaks the `TrackSelector-folderDialog` extension point |

## Consequences

- The panel width, `MIN_PANEL_WIDTH`, `clearFilters` and the
  `facet-showFilters`/`facet-panelWidth` localStorage keys are gone.
