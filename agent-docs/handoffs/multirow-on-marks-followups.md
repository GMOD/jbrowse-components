---
name: multirow-on-marks-followups
description: "What ADR-249's multi-row swap left: refilm tcga/cohort_cnv_clustering on the mark display, confirm CI goes green after 4cf05280d0 (render gate, the two jest shards), and the small items the swap plan listed (feature name in the tooltip, strand preset colors, feature details rerunning a region's steps). The stale-golden triage is its own doc, ideas/ready/browser-goldens-that-may-hide-regressions.md."
---

# Multi-row on the mark display: follow-ups

The swap itself is ADR-249. Left open:

## Next

1. **Refilm `tcga/cohort_cnv_clustering`** (`website/scripts/videos/tcga.ts`).
   `repeats/painting_display_switch` and `epigenomics/chromhmm_cluster` are
   refilmed and pushed; this one still shows the old engine. Rebuild
   `@jbrowse/web`, `TMPDIR=<short> node website/scripts/generate-video.ts
   --filter tcga/cohort_cnv_clustering`, check frames with `ffmpeg -ss`, then
   `node website/scripts/figures.ts push --exact --filter <name>` and commit
   `website/media.lock`.
2. **Check CI on main after 4cf05280d0.** The push before it failed the
   render gate (multi-row painting 1.55%, fixed by 2de7afca18's Canvas2D row
   snap) and six jest suites (fixed by 084720aa4c). `jbrowseModel.test.ts` and
   `AlignmentsSort.test.tsx` are jbrowse-web suites that were fixed without a
   local run: the snapshot line was removed by hand, and the image snapshots
   were renamed to the test's new name.
3. **Small items** from the swap plan, none started: the feature name in the
   mark tooltip (a lookup per hover, since the worker sends no names), strand
   preset colors for Color by, and feature details rerunning the region's
   steps per click (`packages/core/src/rpc/methods/CoreGetEncodedFeature.ts`).

## Decided, don't redo

- The default block color is the mark display's blue, not the feature
  track's goldenrod; nothing in the docs names the old color.
- "One row per..." has no row counts: the scan samples 200 features.
