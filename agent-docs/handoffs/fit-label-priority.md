---
name: fit-label-priority
description: Fit decimation ranks gene names first (4a1b716c94) and thins a same-start pile to its leader (2cad44b0f4). Open are gene names under the auto label density gate, which hides TP53's neighbourhood on a RefSeq GFF loaded with "Show only genes" off, and whether to park the factor cap that drops every name a track cannot fit at 8. Read before touching `labelOverhangRoomPx`, `solveLabelRoomFactors` or the auto label density gate.
---

The `decimated` rung solves gene names' room factor first, then the other
names' beside them (`solveLabelRoomFactors`, `fitLadder.ts`). In a pile of
features sharing one start, only the leader (a gene, else the longest) reads
the gap past the pile (`labelOverhangRoomPx`, `labelReservation.ts`).
**Delete this file once the calls below are answered and built.**

## 1. Gene names under the auto label density gate

Above 0.2 features per px, `showLabels` hides every name on the track, and the
count includes every feature (`baseModel.ts:395-406, 503-508`). Volvox never
reaches it (peak 0.143), and neither does the hosted "NCBI RefSeq (Aug 2024)"
track, whose config sets `showOnlyGenes: true`. The same GFF loaded by a user
gets the default, false. On it at chr17, 1400px wide, 300px tall:

| window | density | gene density | auto | gate bypassed |
| --- | --- | --- | --- | --- |
| 500 kb | 0.278 | 0.031 | 0 names | 49 names, 43 genes |
| 1 Mb | 0.546 | 0.063 | 0 names | 55 names, 40 genes |

At both windows TP53 and its neighbours lose their names while gene density sits at a sixth
to a third of the threshold. Dropping the gate outright is worse, because the non-gene names the
ladder then keeps are "biological region", enhancer IDs such as
`id-GeneID:127885683-3`, and `cDNA_match` hashes.

Options:
- **(a) Recommended: gate each tier on its own density.** Non-gene names hide
  at the threshold. Gene names hide only when gene features alone pass it.
  Sized medium, because every consumer of `showLabels` needs a third "gene names
  only" state, which reaches layout, hit testing, the DOM overlay and SVG
  export.
- (b) Gate on gene density whenever any gene is on screen.
- (c) Leave the density gate as one track-wide switch.

## 2. The factor cap drops every name that can't fit at 8

The bisection stops at a factor of 8 (`FIT_MAX_ROOM_FACTOR`, `fitLadder.ts`).
A name whose room exceeds 8 times its width can't be dropped, so when those
names alone overflow, the solve gives up and every name goes, including ones
that cost no height. A single-tier track has always fallen to `bodies` this
way. In the two-tier solve the same failure drops only the other names
(`labelRoomFactor: Infinity`), and the gene names survive.

Reviewer's case: G 1000-9000 (gene), est 1000-5000, O1 6000-8000, O2
30000-31000, at 10 bp/px and height 70. O1's room is 2400px and O2's is
infinite, so no factor under 8 drops O1, and O2 goes with it though G plus O2
packs to 65px. No volvox reshoot came near the cap; the highest factor solved
was 6.25.

Options:
- **(a) Recommended: park it** until a real track reaches the cap.
- (b) Extend the bracket above 8 to the largest finite room/width ratio, so the
  most isolated names survive instead of none.
- (c) Replace the room measure with each name's height cost. Large; it
  reopens the July and September pile trade-offs (`178f7b8ed4`,
  `6ead7481d1`).

## Not a call

- A display-level test in `fitToDisplayHeight.test.ts` with gene-marked items
  would cover the `namedLabelTiers` / `fitMeasureFeatureIds` wiring, which
  only `layout.test.ts` tests one function at a time.
- The reviewer measured the gene tier at 20 packs instead of 10 in the worst
  case: 85ms against 45ms with 2,000 synthetic features, in node. It applies
  to mixed tracks only, and nothing has profiled it in a browser.
- Fixed-height mode and row order are untouched.
