---
name: multirow-on-marks-followups
description: "What ADR-249's multi-row swap left: confirm CI goes green (render gate, the jbrowse-web suites), and the small items the swap plan listed (feature name in the tooltip, strand preset colors, feature details rerunning a region's steps). The stale-golden triage is its own doc, ideas/ready/browser-goldens-that-may-hide-regressions.md."
---

# Multi-row on the mark display: follow-ups

The swap itself is ADR-249. Left open:

## Next

1. **Check CI on the commit that lands this edit.** The render gate and the
   jbrowse-web suites (`jbrowseModel.test.ts`, `AlignmentsSort.test.tsx`) were
   fixed without a local run, and CI is their first.
2. **Small items** from the swap plan, none started: the feature name in the
   mark tooltip (a lookup per hover, since the worker sends no names), strand
   preset colors for Color by, and feature details rerunning the region's
   steps per click (`packages/core/src/rpc/methods/CoreGetEncodedFeature.ts`).

## Decided, don't redo

- The default block color is the mark display's blue, not the feature
  track's goldenrod; nothing in the docs names the old color.
- "One row per..." has no row counts: the scan samples 200 features.
