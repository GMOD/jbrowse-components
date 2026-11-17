---
name: one-track-list-hierarchy-drawn-calmly
description: Why JBrowse's UCSC-derived track lists sprawl (hg38 799 rows against UCSC's ~117 entries), the three answers tried (folders, a set-row prototype, subcategory bars) and why each is a second hierarchy beside the category tree. The open question is whether nested categories should simply draw as track-height rows. Read before adding a grouping concept to the track selector tree or changing how jb2hubs writes `category`.
---

# One track list hierarchy, drawn calmly

Colin, 2026-11-17, after seeing a set-row prototype: "it is just like...a
hack-around our existing hierarchical tracklist...it is a weird type of
subhierarchy, separate from existing hierarchy, which proves that our existing
hierarchy is too 'noisy' to be used for things like this...and i question what
the right answer is". Open; nothing below is built on main.

## The sprawl, measured

Hosted configs (`https://jbrowse.org/ucsc/<asm>/config.json`) against UCSC's
`api.genome.ucsc.edu/list/tracks`, superTrack members folded into one entry:

| Config | Track rows | UCSC entries for the same data | Largest group opened |
| --- | --- | --- | --- |
| hg38 | 799 | ~117 | Regulation 276 (UCSC 17) |
| hg19 | 528 | ~141 | liftOver 117 |
| hs1 | 627 | ~35 | Variation and Repeats 333 (UCSC 9) |
| mm39 | 143 | ~38 | Pairwise alignments 76 |

Every hosted config collapses its top-level groups, so the drawer opens with
about a dozen rows; the sprawl appears when a group opens. jb2hubs writes
`category: [group]` and folds the UCSC container into the track name ("NCBI
RefSeq - RefSeq Curated"), so the structure lives in strings
(`~/src/jb2hubs/hubtools/src/createTrackConfiguration.ts`). On hg38,
composites hold 361 rows in 30 entries and superTracks 137 in 28; the median
container has 3 tracks.

## Three answers, each a second hierarchy

- **Folders** (`defaultFolderCategories`, "Show as folder"): a category drawn
  as one row that opens a modal table. No hosted config uses it; the hub
  connection never makes one. Kept for now (Colin, 2026-11-17).
- **Subcategory bars**: today's look for `category: [group, set]`. Same row
  count as set rows, but every level is a 40 px teal bar against a 22 px track
  row, so a nested set reads as another section header.
- **Set rows** (a prototype on a local branch, not landed): a level-2 category drawn as a track-height row
  with an on/total count, closed by default, opening in place, member names
  shedding the set prefix, sets of one or two tracks left loose. Its checkbox
  turns on the set's default members, read from the `parent <set> on|off`
  flag the configs keep in `metadata.ucsc`, so NCBI RefSeq is still one click
  (RefSeq Curated). hg38 Genes went 63 → 22 rows, Regulation 276 → 22.
  Rejected as a sub-hierarchy beside the real one.

## Candidate answers

- **One hierarchy, drawn calmly.** Top-level groups stay bars; every category
  below draws like a track row (▸, name, count); a category's checkbox turns on
  its default members, or all when none is marked. A UCSC composite is then
  just a category, jb2hubs nests instead of prefixing, and folders, set rows
  and subcategory bars become one thing. Changes the look of every nested
  category in every config.
- **No hierarchy below groups.** Every composite that is one measurement over
  samples becomes a multi-row track (Fiber-seq: ADR-270, hg38 799 → 558; SGDP
  Copy Number and T2T Encode on hs1 next). Mixed sets such as NCBI RefSeq's
  ten variants stay loose rows.
- **Tree to browse, table to pick.** The tree stays coarse; fine selection is
  table mode with filter chips (ADR-271), closer to UCSC's settings pages.

## Constraints any answer keeps

- NCBI RefSeq must stay one click to turn on (Colin, 2026-11-17).
- "No new tree folders" and a flat category tree (Colin, 2026-11-16; ADR-269
  Consequences).
- The prototype found: every config's level-2 categories change, not only
  UCSC hubs; a filter that shrinks a set to one or two tracks changes the
  tree's shape; jb2hubs must emit set membership and a resolved default
  (members whose parent is a view stanza lose the composite's visibility).
- Returning visitors: config collapse defaults apply only until
  `collapsedCategories` is first written (`loadCategoryModes`), so a change
  that adds closed levels must land in jbrowse-components before jb2hubs emits
  them.
