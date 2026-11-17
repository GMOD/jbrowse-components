---
name: grouped-wiggle-rows-rollout
description: "Getting the Fiber-seq Compendium onto jbrowse.org as six multi-row tracks: grouped wiggle rows (ADR-270) waiting on a release, the jb2hubs branch that collapses hg38 and lifts UCSC subgroups, and ggjbrowse reading grouped rows. Read before releasing, before uploading hg38, or before touching grouped rows in ggjbrowse."
---

# Grouped wiggle rows rollout

- **In:** shipping `rows: { field: 'group' }` (ADR-270) and the jb2hubs
  hg38 config that uses it; ggjbrowse drawing grouped rows.
- **Out:** the track table work (ADR-269) and the track list grammar idea
  (`waiting-on-a-call/the-track-list-config-speaks-the-grammar.md`).

Colin's calls (2026-11-16): the compendium is offered only as multi-row
tracks, no per-cell-line track; haplotypes and CpG-diff thresholds overlaid in
one row per cell line; FIRE peaks a row per cell line; build and upload hg38
when done, with UCSC subgroups lifted into metadata in the same pass; no new
tree folders.

## Where it stands

- **jbrowse-components:** grouped rows landed on local `main` (ADR-270 and the
  commits before and after it). Check `git log origin/main..main` for whether
  they have reached origin.
- **jb2hubs:** branch `fiberseq-rows-subgroups`, worktree
  `~/src/jb2hubs-wt-fiberseq`, also on ada as
  `refs/heads/agent/fiberseq-rows-subgroups`; not merged, not on origin,
  nothing uploaded. It adds a `dataTypes`-driven combine rule
  (`ucsc2jbrowse/combinedTracks/hg38.json`, `combinedTracks.ts`) with a
  `height` per family (500 px for the five signal tracks), hubtools
  `subGroupMetadata` (mirrors `UCSCTrackHubConnection/ucscTrackHub.ts`), and a
  stricter `check-config-compat` that opens one track per rows field. hg38
  goes from 799 tracks to 558.

## Next

- Push `main` once its pre-push gates pass.
- A JBrowse release that reads `rows: { field: 'group' }`: v5.0.0-beta.21
  refuses the three grouped tracks ("invalid configuration"); v4.3.0 opens
  them as one overlaid plot.
- In jb2hubs: move `HOST_VERSIONS` (`scripts/checkConfigCompat.mjs`) to that
  release, rebase the branch, rerun its tests and a scratch build, merge, and
  ship with `./run.sh --configs-only`. GenArk configs gain subgroup metadata
  on their next run.
- FIRE peaks open in the basic display in production `config.json`, which
  strips `LinearMultiRowFeatureDisplay` for v4.3.0; `config-staging.json`
  draws a row per cell line. Moving the v4.3.0 floor is Colin's call.
- ggjbrowse (`~/src/ggjbrowse/R/wiggle.R`): read the tables export's `rows`
  (`index`, `name`, `label`) and `rowsField`; count rows with `nrow(x$rows)`
  instead of `nrow(x$sources)` in `in_rows`, `in_each_row`, `clip_strips` and
  the plot's `n`; label rows from `x$rows$label`; treat `marks$row` as an
  index into `x$rows`; draw a tree only when `rowsField == "source"`.

When this lands, delete this handoff and file any remainder in `ideas/`.
