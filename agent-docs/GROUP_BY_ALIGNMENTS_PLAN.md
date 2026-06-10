# Group-by alignments — decision: stays as subtracks

## Decision

Alignments "group by" (tag / strand) stays implemented as **one session track per
group**, not a single stacked-band display. This is a deliberate
complexity-control choice, not an unfinished state.

## How it works

`plugins/alignments/src/LinearAlignmentsDisplay/dialogs/GroupByDialog.tsx` clones
the track config and calls `session.addTrackConf` + `view.showTrack` once per
group, each a full `LinearAlignmentsDisplay` carrying a copy of the parent
display's state with only `filterBy` swapped. Coverage + pileup per group come
for free because each group is an ordinary alignments display.

## Why subtracks, not a single display

Each group being a real track means it inherits the view's entire per-track
machinery for free:

- independent vertical scroll (correct — groups have different read depths),
  per-track height handles, drag-reorder, per-track menus, selection, SVG export
- **horizontal pan + zoom are already synchronized** because the LGV owns
  `bpPerPx`/`offsetPx` for all its tracks — free and total
- **settings are synchronized at creation** — `buildSubtrackDisplayConfig` copies
  the parent's current display state, so the workflow is *configure the parent,
  then group*; every child comes out identical, and ungroup→tweak→regroup resets

A single "stacked bands" display would have to re-implement every one of those
inside one canvas (scrollable sub-bands, per-band coverage, band chrome/labels,
hit-test offsets, SVG-export parity) **and** would trade away the per-track UI
that makes the current behavior good. It only "wins" on fewer rows in the track
list — a list-management concern, not a rendering one. Rejected.

The one thing subtracks can't cheaply do is **live per-group settings broadcast**
(change color on one group → others follow). That would be invasive (every menu
action fans out, or you reinvent a parent/child display link). Not built on
purpose — the configure-then-group workflow covers the common case. Only revisit
on real user demand.

## Cleanup shipped (the feature done well)

- Unified the tag/strand creators into one `Group[]`-driven loop.
- Deterministic trackIds (`${parentId}-<label>-sessionTrack`, no `Date.now()`):
  re-grouping is idempotent instead of spawning duplicates.
- Groups compose with the parent's active `filterBy` (tag grouping keeps parent
  flags/readName; strand grouping keeps parent tagFilter/readName).
- Untagged uses the `'*'` sentinel `filterTagValue` understands (was relying on
  `String(undefined)` coincidence).
- "Group by... → Remove grouped tracks" (`menus/sortGroup.ts`) finds children by
  id prefix/suffix and deletes them — real ungroup path.
- Grouped tracks share a `category` so they collapse together in the selector.

## Accepted limitation

Groups are snapshotted from the current view (`staticBlocks`) at creation. Scroll
to a region with a tag value not seen at creation and those reads match neither a
per-value group nor untagged — they're not shown in any group. This is intrinsic
to "freeze the groups now" and is accepted: the dynamic-band alternative that
would fix it is exactly the rejected single-display rewrite. If it ever needs
fixing, the cheaper move is letting the dialog re-derive groups on demand (re-run
group-by for the current region), not a new display type.
