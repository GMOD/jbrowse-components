---
name: bezier-overlay-hover
description: The bezier connector overlay's hover, selection and click have unit tests only and have never been looked at in a browser — an owed check that grew on 2026-09-09, when four more commits landed on the same overlay and replaced the SVG highlight boxes it was written against with ink the chrome draws. Two decisions the parked ideas spell out are still open (who draws a same-strand hidden hop in chain mode; the gesture for adding a dashed arc's hidden loci as regions)
---

# Bezier overlay hover handoff

The landing this file was opened for is `cccbf4c1de` and its model-doc
regeneration (2026-09-02, both on main now): a connector hovers, selects and
clicks like the reads it joins. **Four more commits have landed on the same
overlay since, all on 2026-09-09** — `c27c5a7737` (a hover leave respects the
menu's pin, a chain selection clears), `8b93e8dc3d` (a hovered connector boxes
each end on its own row, plus the `PAN_MOVED` guard on the click),
`e335e43fce`, and `bf7a8196c1`. Each is unit-tested and none was looked at in a
browser.

## Owed: a browser check

`bf7a8196c1` is why this is worth re-reading before you shoot it. It **deleted
`computeHighlightBoxes` and `HighlightOverlay`** — the SVG boxes the original
check list named — for `readHighlightInk`, which resolves the hovered ids to
reads, a read to its exon segments, and the segments to the read mark's ink,
clipped to each section's band and merged per row. So the thing to confirm is
now that the *chrome* lights the right ink, not that an overlay draws the right
rects.

Open a split-read BAM (the foldback fixture in `computeOverlay.test.ts` is the
shape) in chain mode with curved connectors on, and confirm:

- hovering one hop of a three-segment read thickens both hops and lights all
  three segments as one span — `mergeRow` in `readHighlightInk.ts` is what
  merges a spliced read's segments and a chain's members, and a chain lights in
  the strong shade through the rect's flag;
- outside chain mode, a hovered connector lights **each end on its own row**.
  This is `8b93e8dc3d`'s fix for a real defect — the merge key had no row, so a
  hovered pair drew one box spanning the reads between the mates, on one mate's
  row, with nothing on the other's. jsdom cannot judge that it is right now;
- clicking near either end of an arc selects that end, not always the first
  (`PileupBezierOverlay.tsx`, `nearerEndpoint`, reads the cursor against the
  SVG's bounding rect — the one part no unit test reaches);
- panning off a curve does **not** open a read's detail widget (the `PAN_MOVED`
  guard, also `8b93e8dc3d`);
- clicking empty canvas un-lights the arc, and a hover leave over a pinned menu
  does not (`c27c5a7737`);
- a collapsed group's rows clip to nothing rather than bleeding into the next
  section (`pileupHeight` 0).

Two smaller things to know before re-filing them:

- `selectReadWithChain` and `readIdsSharingChainWith` on the model still have no
  model-level test; the overlay test mocks both and the canvas click routes
  through the first. Building the display model in a test is the whole session,
  so the browser check above is the cheaper coverage.
- A cross-chromosome same-strand split now curves. The legend used to key that
  colour with a straight-line glyph, which was the mismatch noted here; the key
  draws plain colour boxes now, so the row says nothing about shape either way.

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
