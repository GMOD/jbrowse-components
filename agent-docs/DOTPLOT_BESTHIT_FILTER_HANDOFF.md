# Handoff: best-hit ("one-to-one") alignment filter for dotplot / synteny

## One-line

Whole-genome assembly-vs-reference dotplots look noisy not because
auto-diagonalize orders badly (it doesn't — that's settled, see ADR-034) but
because we **draw every alignment**, including the large mass of real secondary /
repeat / rearrangement hits. The missing feature is a `delta-filter -r -q`-style
**best-hit reduction** on what gets *drawn*. This is a rendering/filter change,
orthogonal to the layout question ADR-034 closed.

## Motivating case

`sv_cgiab/dotplot_result` — HG008T.hap1 (a GIAB **pancreatic-cancer** cell-line
haplotype assembly, 34 contigs) vs GRCh38, whole-genome PIF. It renders as a
scattered cloud that reviewers keep flagging as "not diagonalized."

- Config: `https://jbrowse.org/demos/cgiab/config.json`
- Alignments: `https://jbrowse.org/demos/cgiab/HG008T.hap1.pif.gz` (+ `.tbi`)
- Spec: `website/scripts/specs/synteny.ts` → `sv_cgiab/dotplot_result`

## What was proven (don't re-litigate these)

**1. The diagonalize ordering is correct.** Two independent checks:

- Offline replay of the exact `diagonalizeRegions` algorithm against the real
  PIF produces a cleanly monotonic contig order (bottom→top = chr1→chrX), and
  the rendered plot's visible contigs follow it exactly. Script:
  `agent-docs/dotplot-besthit-filter/replay_diagonalize.mjs`.
- Real `mummerplot` (installed at `/usr/bin`) on the same data agrees. See the
  4-panel montage `agent-docs/dotplot-besthit-filter/mummerplot_comparison.png`.

**2. The scatter is real data, not a layout defect.** Contigs in this cancer
assembly genuinely align across many chromosomes (contig 0016 → 45 chromosomes,
only 49% of its bases to its single best chromosome; 0013 → 25 chromosomes at
58%). No reordering — single- or both-axis — removes cross-chromosome hits.
mummerplot's own RAW output (all alignments) is just as scattered as ours.

**3. mummerplot's "clean" look comes from filtering, not ordering.**
`mummerplot --layout` silently runs `delta-filter -r -q` (1-to-1 best-hit
reduction) *and* reorders **both** axes — which scrambles the readable karyotype
(x-axis came out `chr12, chr21, chr2, chr4…`). ADR-034 rejects that both-axis
reorder for reference-vs-assembly.

**4. Our order + best-hit filter alone = clean diagonal with a readable
reference.** Feeding mummerplot *our* diagonalize order with the reference fixed
in chr1→chrX and **only** `delta-filter -r -q` applied (no `--layout`) yields a
crisp single diagonal (bottom-right panel of the montage). This is the target
render. It proves the only missing ingredient is the best-hit filter.

## The gap in our code

The dotplot has only `minAlignmentLength` — a scalar length cutoff — applied
render-time in `buildLineSegments`
(`plugins/dotplot-view/src/DotplotDisplay/dotplotGeometry.ts`, threaded from
`plugins/dotplot-view/src/DotplotDisplay/afterAttach.ts:128`). A length cutoff
does **not** remove long secondary/repeat alignments, so it can't declutter this.
We need a best-hit filter instead of / in addition to it.

## What `delta-filter -r -q` actually does

Global optimization, not a per-row threshold:

- `-q`: for each **query** sequence, keep the longest-increasing-subsequence
  (LIS) chain of alignments (by score), discarding conflicting ones.
- `-r`: same per **reference** sequence.
- `-r -q`: keep alignments that survive **both** — i.e. mutually-best 1-to-1
  chains. (`delta-filter` source lives in `~/src/vendor/mummer/src/tigr/`,
  `delta.cc` / `deltafilter` if you want the exact LIS/scoring.)

A cheaper, good-enough first cut worth prototyping: for each aligned pair keep
only each query interval's single best (most-bases) reference hit and vice
versa, dropping the rest. Validate visually against the montage's bottom-right.

## Proposed implementation

- Add a display option (bool or enum) e.g. `alignmentFilter: 'none' | 'best-hit'`
  (or `oneToOne`) on `DotplotDisplay`, alongside `minAlignmentLength`
  (`plugins/dotplot-view/src/DotplotDisplay/stateModelFactory.tsx`), with a
  setter, an init field (`DotplotView/afterAttach.ts` `applyInitDisplaySettings`),
  and a control in `DotplotSettingsPopover.tsx`.
- Apply it at the same layer `minAlignmentLength` is applied — over the
  already-fetched `rpcData` in `dotplotGeometry.ts` (all alignments for the view
  are present there, so the LIS/best-hit reduction can run main-thread; memoize
  it since it's O(n log n) over the drawn set). If it turns out too heavy for
  whole-genome PIF, push it worker-side into the render RPC instead.
- **Synteny:** the same win applies to `LinearSyntenyView`. Keep the filter a
  standalone utility so both views share it. Do **not** entangle it with
  `diagonalizeRegions` (ADR-034: that function is shared with synteny's pinned
  cascade and must stay layout-only).

## Acceptance

Enable the filter on `sv_cgiab/dotplot_result` and the render should match the
montage's bottom-right panel: a single clean chr1→chrX diagonal, reference axis
still in readable karyotype order, most light-blue scatter gone. Then flip the
spec's `screenshot-review.json` note ("we may want to use mummerplot algorithm")
— the answer is "best-hit filter, not a new layout algorithm."

## Reproduce the evidence

```bash
# data
curl -s https://jbrowse.org/demos/cgiab/HG008T.hap1.pif.gz    -o /tmp/hap1.pif.gz
curl -s https://jbrowse.org/demos/cgiab/GRCh38_GIABv3.fa.gz.fai | awk '{print $1"\t"$2}' > /tmp/chr.lens
curl -s https://jbrowse.org/demos/cgiab/HG008T.hap1.fa.gz.fai   | awk '{print $1"\t"$2}' > /tmp/contig.lens

# 1. confirm our ordering is monotonic chr1->chrX
node agent-docs/dotplot-besthit-filter/replay_diagonalize.mjs

# 2. PAF(PIF q-lines) -> nucmer .delta + ref/qry order files
node agent-docs/dotplot-besthit-filter/paf2delta.mjs

# 3a. RAW: all alignments (scattered, like ours today)
mummerplot --png --large -R /tmp/ref.order -Q /tmp/qry.order -p /tmp/mp_raw /tmp/hap1.delta
# 3b. --layout: filtered + BOTH axes reordered (clean but scrambles reference)
mummerplot --layout --png --large -R /tmp/ref.order -Q /tmp/qry.order -p /tmp/mp_layout /tmp/hap1.delta
# 3c. TARGET: our contig order + best-hit filter only, reference stays readable
#     (build /tmp/qry.ourorder from replay_diagonalize.mjs output first)
mummerplot --filter --png --large -R /tmp/ref.order -Q /tmp/qry.ourorder -p /tmp/mp_ours /tmp/hap1.delta
```

## Related

- **ADR-034** (`architecture-decision-records/adr-034-...md`) — layout stays
  single-axis; both-axis rejected for ref-vs-assembly. This handoff is the
  complementary *filtering* half it doesn't cover.
- Prior gate fix that made this figure generate at all: the `sv_cgiab/dotplot_result`
  spec now waits on the `dotplot_webgl_canvas_done` test-id, not `readyText:'chr1'`
  (the axis label's SVG `<title>` shadowed puppeteer's `::-p-text` visible wait).
