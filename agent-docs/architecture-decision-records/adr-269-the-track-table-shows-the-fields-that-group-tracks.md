---
status: Accepted
summary: "The drawer's track table shows, beside the name, as many columns as fit: `hierarchical.table.columns` first, then the fields that group tracks, then kind and category if they vary. Manage columns wins. Names shrink from the middle; the filter box needs every word"
---

# ADR-269: The track table shows the fields that group tracks

## Status

Accepted (2026-11-16); ADR-271 turns its facet panel into filter chips that the
tree shares; amended 2026-11-17 by ADR-271, which moves Manage columns to the
track selector's ☰ menu in the drawer and a columns button in the folder
dialog. Built over five commits
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
  category, kind and each top-level metadata key; the most widely set come
  first. A field of links (where tracks came from, shared or not), a per-track description, a constant flag, or a flag with one
  exception (2,100 "Homo sapiens", one "Human") is never a default column,
  nor is a field whose values map one-to-one onto a column already chosen (a
  file format that always says what the kind says).
  The rule runs over every track the drawer can list, so Favorites and Recent
  keep the same columns.
- **Kind and category fill in after them** when they group nothing but at
  least two tracks differ from the field's most common value (no category
  counting as a value), and they don't repeat a column already chosen. Most
  small lists group nothing, so this keeps the table from being a bare list of
  names; the reference sequence alone among tracks of one kind is still the
  one exception, and gets no column. They get no filter chip. (2026-11-17,
  after a review over the repo's test configs and the hosted hubs, where the
  hubs were unchanged and 61 of 97 name-only lists gained a column.)
- **The width decides how many show.** The name keeps up to half the table,
  every other column at least 100 px, and the table shows as many default
  columns as fit beside the name, with no sideways scroll. On hg38 that is
  name, kind, category. The name takes whatever room the others leave, and
  opening the table widens the drawer only to the table's natural width, up to
  45% of the room.
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
- **A name shrinks from the middle.** It keeps its end, the longest run of
  whole words within half the name, and cuts the start first, down to three
  letters, then the end. Tracks from one hub share long prefixes and differ
  at the end. The table's name cell is a flex row, so a long name never hides
  its ⋮ menu. A name with markup is cut at the end.
- **Facets are thin, and few start open.** Rows are 20 px with a 16 px
  checkbox and grey counts; the heading collapses its facet; "clear" shows
  only on a facet with a selection. The panel lists the grouping fields, the
  default columns among them first, plus any field still filtering; a column
  that does not group tracks, configured or shown, gets no facet. Only the
  filters for the first three default columns that group tracks, any grouping
  column the user showed, and any facet still filtering start open; the rest
  are one collapsed heading each. A facet keeps its place when it starts or
  stops filtering, so it never moves under the pointer. A facet lists every value
  up to 20, past that its 10 most common plus any checked one, with "Show N
  more".
- **The filter box needs every word, in any order and field.** `"quotes"`
  keep a phrase, `-word` excludes, and the track text also matches without
  its `-` and `_`, so `thp1` finds "THP-1" (the typed term is not stripped:
  `1.5` must not match "155"). With no sort, the table lists name matches
  first. The box shows "6 of 800" while a query or facet narrows the list,
  and both views highlight the matched words. The syntax is documented once,
  in the user guide.
- **The UCSC hub connection lifts a composite's subgroups into metadata** and
  nests the trackDb stanza under `ucsc`, as jb2hubs' configs do, so a hub's
  cell line, antibody and view are the fields that group its tracks. Its
  track ids still hash the stanza as earlier builds spread it.

## Rejected alternatives

| Alternative | Why |
| --- | --- |
| uFuzzy or another typo-tolerant search | Hub names differ by one character on purpose (H3K27ac/H3K27me3, mm10/mm39, sample ids); a fuzzy match brings in the neighbours and the filter stops being predictable. Every-word matching covers what fuzzy search is mostly wanted for |
| A hint or popover for the query syntax | The common path needs no syntax; a placeholder vanishes when typing starts, and a hint line is sub-label clutter |
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
| A minimum share of tracks before a field groups them | `metadata.source` on 4 of config_demo hg19's 145 tracks earns a chip, but a lifted hg38 hub's `class` subgroup covers fewer (4 of 799) in the same 2×2 shape; any floor that drops one drops the other, and it is a list-size threshold |
| Kind and category whenever they have two values | The reference sequence gives every linear-view list a second kind, so every list would show "Feature" beside every name |
| Per-row precomputed facet strings | Facet counts cost about 30 ms per keystroke at 20,000 tracks once the panel draws few checkboxes; not worth the second copy of each row |

## Consequences

- A test or plugin that finds a long track name with an exact `getByText`
  no longer matches it, since the name is two spans; `getByLabelText` on the
  track's checkbox does.
- Re-timed on ada with a production build at 20,000 tracks: facet panel
  open 68 ms (was 2,463), slowest keystroke with it open 53 ms (was 1,389),
  table keystroke 52 ms (was 150).
- jb2hubs' hosted configs still carry `ucsc.subGroups` unlifted, so their
  tables group less than a connected hub's until the converter lifts them.
  Grouping stays in metadata: a composite does not become a folder in the
  tree, whose categories stay flat (Colin: more hierarchy makes the track list
  look messy).
