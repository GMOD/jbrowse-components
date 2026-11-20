---
status: Accepted
summary: "The drawer's track table shows, beside the name, as many columns as fit: `hierarchical.table.columns` first, then category, then the other fields that group tracks. Rows list in the tree's order, and a name keeps up to two thirds of the width and is cut once, at its end"
---

# ADR-269: The track table shows the fields that group tracks

## Status

Accepted (2026-11-16); ADR-271 turns its facet panel into filter chips that the
tree shares; amended 2026-11-17 by ADR-271, which moves Manage columns to the
track selector's ☰ menu in the drawer and a columns button in the folder
dialog; amended 2026-11-18, when the name's share went from half the table
to two thirds (The width decides how many show); amended 2026-11-18, when
opening the table stopped widening the drawer and a dragged name column
started keeping its width; amended 2026-11-19, after Colin found the table
"confusing": category leads the columns, the rows list
in the tree's order, and a name is cut at its end, not its middle (Category
leads, A name is cut once), and a chip of its own goes only to a field
at least half the tracks have (Facets are thin). Built over five commits
after a code review, a product review and a scale review at 5,000 and 20,000
tracks, judged on the jb2hubs human configs (hg38 799 tracks, hs1 627, hg19
528). Colin asked that the narrow drawer show "a subset of the total metadata
columns" and that facets stay "very thin", and called faceting every metadata
key "a bit silly". A cold Fable review of the config slot (same day) kept its
name, place and string-list shape and changed what a short list means, the
open-filter rule and the docs text.

## Context

The track selector's Tree | Table toggle draws the faceted table inside the
drawer, about 570 px wide in a 1280 px window. It used to show every
non-sparse field (name, kind, category, adapter, description, then each
top-level metadata key in first-seen order), so on hg38 the name column was
cut to "Basewise Co…", the table scrolled sideways, and jb2hubs' constant
`multiWigContainer: true` took a column. An ENCODE-style hub ran 4.6 screens
wide with the useful keys (assay, biosample, target) past the edge. The facet
panel listed every value of every field as an MUI checkbox, about 16,700 at
20,000 tracks, which took 2.5 s to open and up to 1.4 s per keystroke. The
filter box matched its whole contents as one substring, so `fiber thp-1`
found none of the six "Fiber-seq Compendium - THP-1 …" tracks.

## Decision

- **Columns are the fields that group tracks.** A field groups tracks when
  at least two of its values are each shared by two or more tracks, and it
  has no more values than half the tracks that have one. Candidates are
  category, kind and each top-level metadata key. A field of links (where tracks came from, shared or not), a per-track description, a constant flag, or a flag with one
  exception (2,100 "Homo sapiens", one "Human") is never a default column,
  nor is a field whose values map one-to-one onto a column already chosen (a
  file format that always says what the kind says).
  The rule runs over every track the drawer can list, so Favorites and Recent
  keep the same columns.
- **Category leads; the other grouping fields follow, the most widely set
  first.** Every track has a kind, so kind used to rank first and take the
  one column a 384 px drawer fits. The table then gave no sign of where the
  tree files a track, beside a column whose value changed from row to row:
  "it is completely unclear what category everything is in", and kind "is
  very distracting too because it is not by default sorted" (Colin,
  2026-11-19). Kind is now the second column, shown once the drawer has room
  for two, and its filter chip stays beside category's. Until a header is
  clicked the rows list in the order the tree draws them (a category's own
  tracks, then its subcategories as first seen), so the category column reads
  in runs; config order alone does not give that (volvox's 131 tracks change
  category 58 times down the list, config_demo's 262 tracks 94 times).
  Favorites and Recent keep their own order.
- **Category and kind still fill in** when they group nothing but at
  least two tracks differ from the field's most common value (no category
  counting as a value), and they don't repeat a column already chosen. Most
  small lists group nothing, so this keeps the table from being a bare list of
  names; the reference sequence alone among tracks of one kind is still the
  one exception, and gets no column. They get no filter chip. (2026-11-17,
  after a review over the repo's test configs and the hosted hubs, where the
  hubs were unchanged and 61 of 97 name-only lists gained a column.)
- **The width decides how many show.** The name keeps up to two thirds of the
  table, every other column at least 100 px, and the table shows as many
  default columns as fit beside the name, with no sideways scroll. On hg38 in
  the usual drawer that is name and category, and a wider drawer adds kind.
  Column labels start with a capital, as a hub's metadata keys mostly do. The name takes whatever room the others leave until
  its edge is dragged, which gives it a width of its own, and the table opens
  at the drawer's current width: Colin found widening the drawer on open
  presumptive (2026-11-18).
- **`configuration.hierarchical.table.columns` ranks columns first** for a
  hub whose metadata has many keys of which a few matter. It is a string list
  of field paths (`category`, `kind`, `description`, `adapter`,
  `metadata.<key>`), most important first; the grouping fields fill whatever
  room it leaves, so an admin writes the three keys that matter and an entry
  no track has falls back to deriving. `name` is always first and is not an
  entry. `jbrowse validate` warns about an entry no track in the file
  carries, rather than the app warning at runtime.
- **Manage columns wins either way.** It sits in the track selector's ☰ menu
  in table mode and the folder dialog's columns button (ADR-271, amended),
  lists every field and records
  `[{ field, show }]` per config and assembly in localStorage. A shown column
  shows however narrow the table, and may scroll it; a hidden one never shows,
  and hiding the sorted column drops the sort. The sorted column shows
  however narrow the table, as a shown one does, and a sort on a field no
  longer offered as a column is dropped, so the order is never hidden
  (2026-11-17).
- **Description is hover text, not a column.** The name cell's title is the
  name and the description, as the tree's tooltip is.
- **A name is cut once, at its end,** in the tree and the table. The table's
  name cell is a flex row, so a long name never hides its ⋮ menu, and its
  hover text is the whole name.
- **Facets are thin, and few start open.** Rows are 20 px with a 16 px
  checkbox and grey counts; the heading collapses its facet; "clear" shows
  only on a facet with a selection. The panel lists the grouping fields, the
  default columns among them first, plus any field still filtering; a column
  that does not group tracks, configured or shown, gets no facet. Only the
  filters for the first three default columns that group tracks, any grouping
  column the user showed, and any facet still filtering start open; the rest
  are one collapsed heading each. Of those three, a column the config does
  not name starts open only when at least half the tracks have a value for
  it (2026-11-19): the hosted hg19's "Views" chip, a UCSC subgroup 75 of its
  528 tracks carry, sat beside Kind over every screen of the tree, and now
  waits behind "More filters" with the ten other keys that each belong to a
  few data sets. A facet keeps its place when it starts or
  stops filtering, so it never moves under the pointer. A facet lists every value
  up to 20, past that its 10 most common plus any checked one, with "Show N
  more".
- **The filter box needs every word, in any order and field.** `"quotes"`
  keep a phrase, `-word` excludes, and the track text also matches without
  its `-` and `_`, so `thp1` finds "THP-1" (the typed term is not stripped:
  `1.5` must not match "155"). With no sort, the table lists name matches
  first. The box shows "6 of 800" while a query or facet narrows the list,
  and both views highlight the matched words. The syntax is documented once,
  in the user guide. Every other table's search box (feature details, the
  spreadsheet, the session manager) reads the same language from
  `@jbrowse/core/util/searchText`; a minus before a plain number is part of
  the number, so `-2.3` in a sheet finds a fold change.
- **The UCSC hub connection lifts a composite's subgroups into metadata** and
  nests the trackDb stanza under `ucsc`, as jb2hubs' configs do, so a hub's
  cell line, antibody and view are the fields that group its tracks. Its
  track ids still hash the stanza as earlier builds spread it.

## Rejected alternatives

| Alternative | Why |
| --- | --- |
| uFuzzy or another typo-tolerant search | Hub names differ by one character on purpose (H3K27ac/H3K27me3, mm10/mm39, sample ids); a fuzzy match brings in the neighbours and the filter stops being predictable. Every-word matching covers what fuzzy search is mostly wanted for |
| A hint or popover for the query syntax | The common path needs no syntax; a placeholder vanishes when typing starts, and a hint line is sub-label clutter |
| A name shrinking from the middle, keeping its last words (2026-11-16 to 11-19) | Built because tracks from one hub share a prefix and differ at the end, but an ellipsis in the middle of every long row, in the tree as well, was "incredibly distracting to see" (Colin, 2026-11-19). The name's two thirds of the table and the hover text do that job |
| Kind ranked by how many tracks have one (2026-11-16 to 11-19) | Every track has a kind, so it took the one column a usual drawer fits and pushed category out |
| Kind after every metadata key | On hg38 the second column became a UCSC subgroup most tracks leave blank, and kind's filter chip dropped behind "More filters" |
| Category headings between the table's rows, as the tree draws them | A second way to draw the tree, and a column sort breaks the groups; the column costs one sortable, filterable field |
| Sorting the table by category on open | Marks a column as sorted that the user never clicked, and reorders the categories away from the tree's order |
| The name keeping half the table (2026-11-16 to 11-18) | On hg38 it cut 13 of the first 23 names twice, in the middle and at the end ("Basewise Co… - 30-way vertebrate alignme…"), to make room for a category column whose values were also cut |
| Description as a default column | It is per-track prose that duplicates the name on UCSC hubs (`longLabel`), and it took the width the name needs |
| A pinned (sticky) name column | The default no longer scrolls sideways; only a user's own shown columns can |
| The "Show sparse metadata columns" toggle | The grouping rule replaces the 5-track threshold, and Manage columns lists every field |
| A hide-list (`hiddenColumns`) for user choices | Cannot say "show a column the default left out" |
| Showing every grouping field's facet open | An ENCODE-style hub lists fifteen facets of values nobody asked for |
| A hidden whole-name text node beside the two halves, for `getByText` | Doubles every label's `textContent`. Tests find a track by its checkbox's label instead |
| Splitting only names over a length threshold | Couples layout to a guessed width; a narrow column cuts a short name too |
| Stripping `-`, `_` and `.` from the typed term as well | `1.5` matched "dbSNP(155)" and `a.b` 125 hg38 tracks |
| A second config list for which filters start open | Columns and open filters would disagree, and it doubles the surface; the filters follow the first three columns |
| Object entries in `table.columns` (label, width, open-as-filter) | A label belongs to the field everywhere it shows, a width is the layout's, and open-as-filter is the second list again |
| Bare metadata keys in `table.columns` | Collide with a metadata key named `category`, `kind` or `name`; the prefix is how a track config spells the path |
| A configured list that is the whole column set | A two-entry list left the rest of the width empty and dropped category unless repeated |
| Three chips whatever share of the tracks each field covers (2026-11-16 to 11-19) | A sparse subgroup key took an always-visible chip on every UCSC genome with one composite that had subgroups. Whether a field groups tracks still has no floor (next row); only a chip of its own does |
| A minimum share of tracks before a field groups them | `metadata.source` on 4 of config_demo hg19's 145 tracks earns a chip, but a lifted hg38 hub's `class` subgroup covers fewer (4 of 799) in the same 2×2 shape; any floor that drops one drops the other, and it is a list-size threshold |
| Kind and category whenever they have two values | The reference sequence gives every linear-view list a second kind, so every list would show "Feature" beside every name |
| Per-row precomputed facet strings | Facet counts cost about 30 ms per keystroke at 20,000 tracks once the panel draws few checkboxes; not worth the second copy of each row |

## Consequences

- Re-timed on ada with a production build at 20,000 tracks: facet panel
  open 68 ms (was 2,463), slowest keystroke with it open 53 ms (was 1,389),
  table keystroke 52 ms (was 150).
- jb2hubs' hosted configs still carry `ucsc.subGroups` unlifted, so their
  tables group less than a connected hub's until the converter lifts them.
  Grouping stays in metadata: a composite does not become a folder in the
  tree, whose categories stay flat (Colin: more hierarchy makes the track list
  look messy).
