---
id: linear-comparative-view
title: linear-comparative-view
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## buildSplitViewFromPath

A breakpoint split view over the loci a reconstructed path visits.

ONE PANEL PER VISITED WINDOW, not per chromosome. The segments are already in
the order the reads cross them, so a path that leaves chr9 and comes back to
it 27 kb away gets two chr9 panels. A segment whose window overlaps a panel
already opened on its chromosome reuses that panel instead: COLO829's
fold-back ends at the chr3 junction it starts from, the split view attaches
each alignment to the first panel showing it, and a fourth panel over the
same stretch drew no connections at all.

The launching view's tracks are carried onto every panel, alignments tracks
included, because the reads leaving one panel and arriving in the next are the
whole content of this view type.

One panel per segment is also one fetch per segment, and nothing bounds a
path's segment count, so **this throws above MAX_SPLIT_PANELS
segments**. Truncating instead would draw a prefix of a path under the whole
path's name, the same failure the strip's gap squeeze avoids, and returning a snapshot the caller has to measure is a rule to
remember rather than one the code holds. The in-tree picker never reaches the
throw — it disables the option and offers synteny, which has no such limit.

```js
// type signature
({ candidate, tracks, windowSize, }: { candidate: DerivativeCandidate; tracks: TrackSnapshot[]; windowSize?: number | undefined; }) => SplitViewFromPathSpec
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearDerivativeVsRef/buildSplitViewFromPath.ts)
