---
name: pif-coarse-tier-rollout
description: The 2026-09-02 PIF coarse-tier work (the cr:Z: coarse CIGAR, its walks, the #pif header) landed and was cross-reviewed twice; the format is frozen (ADR-104). What is still owed before and after the jb2hubs rollout — the hosted rebuild, the main thread reading the header's bound, the region launch's fine-tier fetch, the min-of-both-rows fine fetch, SNPs from sequence at base zoom — with where each belongs when this closes.
---

# PIF coarse tier rollout, 2026-09-02

The two-tier PIF is going wide on jb2hubs. This thread replaced the coarse
tier's CIGAR-less split rows with a coarse CIGAR, taught every walker to follow
it, and froze the format. Read `ADR-104`, then `reference/SYNTENY_LOD.md`, then
`website/docs/developer_guides/pif_format.md` before touching `make-pif`, the
indexed PIF adapters, `coarsenCigar`, `getAlignmentOps` or `resolveLodTier`.

Commits carry `Claude-Session: https://claude.ai/code/session_01KgSDpmBteTcXcV5XB5QKTE`;
`git log --grep session_01KgSDpmBteTcXcV5XB5QKTE` lists them. In order:
`23d807d6c7` (the format), `4c1007974d` (move-panel and follow walk the fold),
`3936dcfa01` (seven gaps from the first Fable review), `d6db173807` (the
`#pif` header and the four writer changes the second review asked for before
any hosted rebuild).

Both reviews' findings are settled except the items below. The second review's
verdict: the `cr` grammar is safe to freeze; nothing found changes a byte of an
existing value.

## Owed before the hosted rebuild

- **Rebuild every hosted PIF** in the `HOSTING.md` table: all predate `cr` and
  the header, and draw as plain ribbons until rebuilt. Sources are not on this
  machine (`~/data` has bison, horse, sunflower, yeast; not hs1ToMm39 or the
  hg38 liftOvers). Starting points: `scripts/build_hpylori_synteny.sh`,
  `scripts/build_ecoli_pangenome_graph.sh`, `scripts/verify-hs1-mm39-dotplot.mjs`.
  Deploy only with `scripts/deploy-demo.sh`; read its header on size changes
  tearing byte ranges for a minute. A hub that must serve a JBrowse older than
  2026-09-02 builds with `--no-coarse` (`pif_format.md` says why).
  → `TODO.md` when this closes.

## Owed after it

- **The main thread does not read the header's bound.** `PifFile.meta` has it
  (`coarse:i:`), but `coarseBpPerPxThreshold` is still a config slot that must
  be `>= --coarse` with nothing enforcing it, a `--no-coarse` file pinned to
  coarse still refetches identical bytes at the threshold
  (`ideas/single-tier-pif-refetches-at-the-threshold.md`), and
  `LinearSyntenyDisplay.coarseWalkIsApproximate` reads the requested tier, not
  the served one. One shape fixes all three: a one-shot RPC in `afterAttach`
  that returns `meta` (the `LinearHicDisplay` binsize pattern), stored on the
  display, read by `resolveLodTier`. → `ideas/`, or fold into the existing
  single-tier-refetch idea.
- **The region launch reads the fine tier genome-wide.**
  `LaunchSyntenyView/executeDiscoverMates.ts` passes no `lodMode`; with the
  fold walkable it could serve coarse past the threshold. 64 MB per launch on
  hs1 vs mm39 (`SYNTENY_LOD.md` wire table). → `TODO.md`, measure first.
- **One zoomed-in row forces a whole-genome fine fetch.**
  `LinearSyntenyDisplay.lodTier` resolves off `min(bpPerPx)` of both rows, so a
  whole-genome top row against a zoomed-in bottom row fetches the fine tier
  across the genome. A per-axis tier needs the bidirectional fetch
  (`bidirectionalFetch`, `ideas/two-axis-synteny-fetch.md`). → measure on a
  real hub file before building; `ideas/` if it pays.
- **LGVSyntenyDisplay's tier is an `rpcProps` field read off live `bpPerPx`**,
  so a threshold crossing mid-gesture clears every region's held data. Already
  parked: `ideas/discrete-zoom-thresholds-in-rpc-props.md`. Confirmed by the
  second review; nothing new to file.
- **SNPs at base zoom.** The owner's steer is the BAM/CRAM model: fetch both
  assemblies' sequence for the small visible window and compute mismatches
  through the CIGAR at render time, not `cs` bases in the PIF. The second
  review's specifics: the worker needs the mate assembly's sequence adapter
  config and alias map passed in (the "resolve before the RPC" rule in
  `CLAUDE.md`), mate ranges batched per refName; minus strand walks the mate
  from `mateEnd` down against the complement; with `--eqx`/`cs` the `=`/`X`
  positions are already in the fine CIGAR and sequence only supplies base
  colour, while an M-only `cg` needs a full compare across the window; an
  all-vs-all with an unloaded mate assembly degrades to no SNPs. Fine-tier
  only; the fold never needs bases. → `ideas/` as a worked proposal.
- **Feature ids are file offsets**, so a selection does not survive a tier
  switch. A per-alignment id tag on every row of one PAF row is the fix; judged
  skippable. → `REJECTED_IDEAS.md` if nobody asks for it.
- **The fetch unit is the whole alignment**: a chain-scale fine row downloads
  its multi-MB CIGAR to draw a small window. A chunked fine tier is the
  eventual fix and the same problem whether or not SNPs are drawn.
  `ideas/synteny-comparative.md` §"No intra-record slicing" already holds it.

## Decisions taken, not to reopen

- `N` keeps the row's own axis on the Q row in both `cg` and `cr`, matching
  `swapIndelCigar`. Changing it later is a format change; the second review
  asked for the decision to be explicit. Documented in `pif_format.md`.
- `--coarse` is the tier's accuracy bound, positive only; indels over half of
  it are kept; a tagless coarse row in a file whose header says
  `cigars:Z:all` is one run within the bound (`coarseRowsAreBounded`).
- A `cr` run is the same shape as a lib_tracepoints `(a_len, b_len)` pair,
  segmented by kept gaps and skew rather than diff count; nothing to build.

## State of the tree when this was written

`pnpm typecheck` 0 errors, `pnpm test-related` 545 suites green after
`d6db173807`. The pre-commit hook's tree-wide report names another session's
`plugins/canvas/src/LinearMultiRowFeatureDisplay` work; not this thread's.
`test_data/volvox/volvox_ins_coarse.pif.gz` is built with `--coarse 1000` so
its one 4.8 kb insertion survives into the fold, and now carries the header.
