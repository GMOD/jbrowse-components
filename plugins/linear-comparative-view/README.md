# @jbrowse/plugin-linear-comparative-view

JBrowse 2 linear comparative view

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### buildSplitViewFromPath

A breakpoint split view over the loci a reconstructed path visits.

ONE PANEL PER SEGMENT, not per chromosome. The segments are already in the order
the reads cross them, so a path that leaves chr9 and comes back to it inverted
gets two chr9 panels rather than one that quietly merges the two visits — which
is the case a hand-built import form gets wrong, since a person filling in rows
types each chromosome once.

The launching view's tracks are carried onto every panel, alignments tracks
included, because the reads leaving one panel and arriving in the next are the
whole content of this view type.

One panel per segment is also one fetch per segment, and nothing bounds a path's
segment count, so **this throws above MAX_SPLIT_PANELS segments**. Truncating
instead would draw a prefix of a path under the whole path's name, which is the
failure the strip's own gap squeeze exists to avoid, and returning a snapshot
the caller has to measure is a rule to remember rather than one the code holds.
The in-tree picker never reaches the throw — it disables the option and offers
synteny, which has no such limit.

```js
// type signature
({ candidate, tracks, windowSize, }: { candidate: DerivativeCandidate; tracks: TrackSnapshot[]; windowSize?: number | undefined; }) => SplitViewFromPathSpec
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearDerivativeVsRef/buildSplitViewFromPath.ts)

<!-- API_DOCS_END -->
