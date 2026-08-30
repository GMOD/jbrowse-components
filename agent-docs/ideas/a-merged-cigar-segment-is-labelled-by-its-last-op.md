---
name: a-merged-cigar-segment-is-labelled-by-its-last-op
description: visitCigarRenderedSegments merges sub-pixel ops into one segment and then names that segment after whichever op closed it, so match bases merged ahead of a rendered indel are painted as indel — invisible in transparent-indels mode, over-coloured in colored. Bounded by a pixel per indel, except where match runs are consistently sub-pixel and the indels are not, which paints the feature as nothing at all. The fix is a flush that no capacity bound in buildSyntenyGeometry currently allows for.
---

# A merged CIGAR segment is labelled by its last op

`packages/cigar-utils/src/cigarRenderedSegments.ts` accumulates ops until the
segment clears a pixel on one axis, then flushes it:

```js
const resolvedOp = span1 > bpPerPx0 || span2 > bpPerPx1 ? op : CIGAR_M
```

`op` is whichever op tripped the flush. When that is a deletion or insertion
wide enough to render, every match base merged into the segment ahead of it is
labelled as part of the indel:

- **transparent indels** (`cigarMode: 'matches'`) drop the segment entirely —
  `cigarSegmentKind` emits no tile for an indel — so those match bases are
  unpainted ribbon;
- **colored indels** paint the whole segment as an indel wedge, so the indel
  reads wider than it is.

## How much

Bounded by **one pixel of each axis per rendered indel**: a segment stops
merging the moment it clears a pixel on either axis, so the context ahead of the
flushing op is sub-pixel on both by construction. On an ordinary alignment that
is a sliver beside each indel — the same family as the trailing-end hole
`clipSyntenyFeature.ts` documents.

It stops being a sliver where match runs are consistently **sub-pixel** and the
indels between them are **not**: every flush is then an indel flush, and
transparent mode emits no ribbon instances for the feature at all. Built through
`buildSyntenyGeometry` at 100 bp/px, a feature alternating 50 bp matches with
150 bp deletions emits 700 `KIND_CIGAR_D` quads plus a full-span base in colored
mode and **nothing but location markers** in transparent mode: invisible, and so
also unhoverable, since the pick engine's feature bodies
([SYNTENY_PICKING.md](../reference/SYNTENY_PICKING.md)) are built from tiles that
do not exist. A repeat-expansion locus is the realistic shape of that.

## Why it is parked rather than fixed

The principled fix is to **flush the accumulated match context before starting a
rendered indel**, so an indel never absorbs the matches ahead of it. That adds a
segment per rendered indel, and `buildSyntenyGeometry`'s capacity bound does not
allow for it:

```js
cigarBudget = Math.min(cigar.length, Math.ceil(widthPx0 + widthPx1) + 4)
```

The pixel arm rests on "a segment is emitted only when an axis advanced more
than a pixel", which the extra flush breaks — worst case (a 1 bp match before
every rendered indel) it doubles the emissions against a bound the `min` is
already picking. Capacity there is not slack: the lanes are handed out as
`subarray` views and transferred across the RPC boundary, so widening the bound
is paid on every CIGAR feature in view, and overrunning it drops instances
silently (`addRibbon` guards the write, and the cursor keeps counting).

So the fix is one of: re-derive the pixel bound for the new emission rule and
accept what it costs; split the flushed context and the indel into one quad each
only where the context is non-empty AND the bound has room; or carry the match
portion as a sub-span of the same quad, which needs a second corner pair per
instance and is a geometry change.

`visitCigarRenderedSegments` is shared with the dotplot, which draws the same
segments as lines, so whichever it is lands in both views.
