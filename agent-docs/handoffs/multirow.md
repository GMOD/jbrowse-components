
All three branches are on local main (not pushed), and their worktrees and branches are removed.

1. MAF: source-chromosome colouring and the summary bars now draw on the GPU. Before the port those paths cost 236 ms and 989 ms of work per frame. The CDS frame strip stays as it was, because the span shape can't draw a band thinner than 1 px. The summary-bar pair's cross-backend threshold is 9% instead of 1.5%: the GPU closes seams that Canvas2D leaves between bars, and a 9% threshold keeps Canvas2D pixels exactly as they are.
2. One colour-key rule for the mark, multi-row and variant displays:
   - alu_age's FLAM and FRAM share one key row.
   - The chromHMM key no longer reorders when you pan.
   - The 61-row variant key is gone.
   - A single-value variant field keeps its row.
3. GPU row table, stage 1, on the multi-row display (ADR-165):
   - Reordering 1,000 rows went from 10.7 ms and 7.8 MB per region to 0.22 ms and 7.8 KB. Reorder, focus, recolour and cluster now rebuild only the table.
   - The browser gate compared 32 Canvas2D/WebGL pairs, none over threshold.

Each branch passed typecheck and its affected suites after its final rebase. Two failures come from main, not these branches: render-core's publicApi.test.ts (the link-mark exports were never snapshotted) and one fetch-autorun test.

Still to do, in order: the identity colour scale once the other session's worktree-canvas-grammar lands, ADR-152's two encoder changes, and row table stage 2 for bars, points and wiggle. The memory note has these next steps; the decision page still lists your pending calls.
