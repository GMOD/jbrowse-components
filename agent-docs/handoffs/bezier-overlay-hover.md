---
name: bezier-overlay-hover
description: The bezier connector overlay's hover, selection and click landed on worktree-bezier-overlay-hover with unit tests only — waiting on a browser check against a split-read BAM in chain mode, and on two decisions the parked ideas now spell out (who draws a same-strand hidden hop in chain mode; the gesture for adding a dashed arc's hidden loci as regions)
---

# Bezier overlay hover handoff

The first two commits on `worktree-bezier-overlay-hover` (`7256ecfdc9`, and
the model-doc regeneration `0164671960`; the pre-commit gate rebases the branch
when main moves, so match by subject if these have drifted): a connector
hovers, selects and clicks like the reads it joins.
Lint, typecheck and `pnpm test-related` are green; `--with-web` was not run,
since no slot, menu, label or snapshot shape moved.

## Owed: a browser check

Nothing in the commit was looked at in a browser. Open a split-read BAM (the
foldback fixture in `computeOverlay.test.ts` is the shape) in chain mode with
curved connectors on, and confirm:

- hovering one hop of a three-segment read thickens both hops and boxes all
  three segments;
- clicking near either end of an arc selects that end, not always the first
  (`PileupBezierOverlay.tsx`, `nearerEndpoint`, reads the cursor against the
  SVG's bounding rect — the one part no unit test reaches);
- clicking empty canvas un-thickens the arc;
- outside chain mode, hovering an arc boxes both ends with the chain shading,
  which is stronger than a single read's. The reviewer asked for it; it is a
  visual call whether two reads should read as a chain.

Two smaller things to know before re-filing them:

- `selectReadWithChain` and `readIdsSharingChainWith` on the model have no
  model-level test; the overlay test mocks both and the canvas click now routes
  through the first. Building the display model in a test is the whole session,
  so the browser check above is the cheaper coverage.
- A cross-chromosome same-strand split now curves, but the legend's glyph for
  that colour is still a line (`connectionMark` is per colour and cannot see
  refNames). Accepted as-is.

## Decisions, filed where they belong

- **Same-strand hidden hop still drawn solid** — two problems, one per layout
  mode, and the chain-mode one is the ownership decision:
  [`ideas/a-same-strand-junction-across-unfetched-segments-is-still-drawn-solid.md`](../ideas/a-same-strand-junction-across-unfetched-segments-is-still-drawn-solid.md).
  The pileup half is ready to build.
- **Dashed arc loci as regions** — plumbing is small, gesture is the open half:
  [`ideas/sa-hops-in-the-bezier-overlay.md`](../ideas/sa-hops-in-the-bezier-overlay.md),
  "A dashed arc names loci nobody can act on".
- **The enumeration cost** behind both is in the same two docs, from
  `plugins/alignments/benches/bezierEnumerate.probe.ts`. The first run of that
  probe, taken while a typecheck ran on the same box, was 4x the quiet number
  and briefly made it into both docs. Quote the min of a quiet run.

Close this file once the browser check is done and the two ideas carry
whatever it finds.
