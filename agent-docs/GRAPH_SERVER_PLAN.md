# Graph-server plan

Companion to `GRAPH_PLAN.md` — that file plans the **static-file tabix index**
publication path; this one plans the **express + odgi runtime backend**
(`tools/graph-server` + `plugins/comparative-adapters/src/GfaServerAdapter`).
The two paths are kept parallel so the server can serve as the ground-truth
oracle for the static-file output and as the prototyping vehicle for new
features before they get encoded into the preprocessor.

> **adr-025 supersedes this plan's bubble-CS work.** The per-base SNP/indel
> overlay that earlier phases drove into the synteny features has been retired
> in favour of a standard `vg deconstruct` VCF track. Sections below that
> describe `bubbles.bed.gz`, `bubbleOverlay.ts`, server-side CS chaining, or
> the server-vs-tabix oracle script are historical record only — the code
> they describe is gone.

---

## Status (2026-05-13)

| Component | State |
|---|---|
| `tools/graph-server` Express service | done |
| `/setup`, `/subgraph`, `/synteny` endpoints | done |
| W→P GFA conversion + cached `.og` build | done |
| `GfaServerAdapter` (multi-pair + getSubgraph) | done |
| Volvox manual smoke + chr20 perf bench | done |
| Puppeteer e2e (`suites/graph-server.ts`) | done, gated `requiresRemote: true` |
| Bubble CS derivation (forward + reverse strand chaining) | removed (adr-025) |
| Server ↔ tabix oracle (`compare-vs-tabix.ts`) | removed (adr-025) |
| Multi-LGV synteny block rendering (server-fed) | works |
| Graph view (Bandage layout) at SV region | works |
| `backend: 'vg'` opt-in (vg find + xg index) | done — ~10× faster cold extract on HPRC chr20 |
| `parsePanSN` 4-part haplotype names (vg fragmented assemblies) | done — `sample#hap#contig#fragment` aggregates to `sample#hap` |
| `/setup` paths sidecar disk cache | done — chr20 boot setup 55 s → ~100 ms |
| `parsePanSN` unit tests (`test/datasets.test.ts`) | done |

---

## Phase 1 — SNP top-stripe coloring (resolved 2026-05-12)

Confirmed by runtime instrumentation: the server adapter pipeline is correct
end-to-end on all three backends.

- Server emits 8658 substitution CS ops over 351 SNP positions for volvox
  ctgA:0-50001.
- Worker (`MultiPairGetFeatures`) builds `snpPositions/Heights/ColorTypes/
  RelDepths` with `snpCount=351`, `coverageMaxDepth=100`, all four base
  colors represented.
- Main-thread `buildSyntenyRegionMap` packs `packedSnpSegs=351`,
  `packedCovBins=1268`, with `showCoverage=true`.
- Canvas2D backend's `drawSnpSegments` issues 351 valid fillRect calls;
  WebGL backend renders the same buffers via the SNP pass shader.

Snapshots regenerated under default, `--backend=webgl`, and
`--backend=canvas2d` all show the full SNP top stripe and in-row SNP
detail. The originally checked-in
`__snapshots__/graph-server-multilgv-canvas.png` predated some change
in the upstream synteny rendering pipeline; nothing in the server-adapter
path itself ever produced the blank stripe.

Diagnostic probe `tools/graph-server/test/debug-snp.ts` is kept — it spawns
the server, fetches `/synteny` for ctgA:0-50001, runs the worker pipeline
locally, and dumps `snpCount`/`maxDepth`/per-genome coverage. Useful as a
sanity check when adding new server-side fields.

---

## Phase 2 — Reverse-strand + multi-strand runs (chain logic done 2026-05-12)

`collapseRunsWithBubbleCs` now chains same-strand same-genome runs in both
orientations. For strand=-1 chains the mate walks backward as ref advances
(`b.mateEnd <= cur.mateStart`), and the alt-query gap is reverse-complemented
before diffing against altR so the emitted cs aligns to ref forward. cs
remains parser-compatible with `extractMismatchesFromCs` (ref-forward refPos
walk).

Unit tests added in `test/synteny.test.ts`:
- `reverse-strand chain emits ref-forward cs with revcomped alt` — SNP case
  (node 4=CT vs ref node 2=GG via `3-,4-,1-`; cs `:4*gc*gt:4`).
- `reverse-strand chain encodes an indel bubble correctly` — 4bp insertion
  case (cs `:4+aacc:2:4`).

Outstanding:
- Verify against an HPRC chr20 inversion (one of the SV-bubble regions
  documented in `bubbles.bed.gz`) using the server's `/synteny` endpoint.
- Mixed strand=+1 / strand=-1 transitions still break a run intentionally
  — an inversion boundary is a real biological event, not noise to smooth
  over. Revisit if dual-strand cumulative cs becomes a renderer requirement.

---

## Phase 3 — Server ↔ tabix correctness oracle (2026-05-12)

`tools/graph-server/test/compare-vs-tabix.ts` spawns the server against
volvox and, for every `/synteny` feature, walks its cs into a per-position
event list `{refPos, kind: snp|ins|del, base, length}` and diffs it against
the analogous event list built from `bubbles.bed.gz` rows fully contained
in the feature's span attributed to the feature's `queryGenome`.

Schema note (cost a debug pass to discover, now documented in the script
comments): in `bubbles.bed.gz`, column 7 = samples carrying allele A
(col 3), column 8 = samples carrying allele B (col 4). For alleleA=0 rows,
col 8 holds the *non-ref* samples, not col 7.

Run:
```
pnpm exec node --experimental-strip-types tools/graph-server/test/compare-vs-tabix.ts
```

### Results on volvox 50-sample (ctgA:0-50001)

| Region | server events | tabix events | SNP divs | indel divs |
|---|---|---|---|---|
| 0–5000 | 858 | 858 | 0 | 234 |
| 5000–15000 | 535 | 535 | 0 | 160 |
| 15000–50001 | 8134 | 8115 | 19 | 1318 |

Total event counts match within 0.2%. **Zero base-differs and zero
kind-differs**: when both backends place an event at the same refPos
they always agree on snp/ins/del and on the substituted base. SNP
divergences are essentially zero across the first 15 kbp and 0.2% across
the larger 35 kbp region.

### Known divergence pattern (encoding ambiguity, not a correctness bug)

Indel divergences cluster in **tight position pairs** (e.g.
`-206:del,+209:del`, `-16618:ins,+16896:ins`): one backend places a
deletion at refPos X, the other at X±a few bp. This is classic
left/right-anchoring ambiguity on repetitive sequence — both
representations describe the same biological event. Neither backend is
"more correct"; both are valid edit scripts for the same gap.

User-facing impact for MultiLGVSyntenyDisplay: the SNP color stripe (the
primary signal users compare to) is pixel-equivalent because SNPs are
exact-position events. Indel indicators (insertion arrows, deletion
gaps) may shift by a few pixels on repetitive regions.

### Outstanding

- The 19 SNP divergences in ctgA:15000-50001 — sub-percent but non-zero.
  Worth a focused dig: dump the feature, replay `csToEvents` on both
  sides, find the offending positions, identify whether `buildCs` is
  losing a position near a bubble boundary. Filed as a follow-up.
- HPRC chr20 run: needs `~/chr20-test/chr20.og` plus the matching
  `bubbles.bed.gz` and `synteny.bed.gz` produced by `tools/gfa-to-tabix`.
  Should run with the same oracle once the index files exist.
- Indel-anchor canonicalization: if we ever need byte-equality on
  indels, both backends would need to converge on a single anchoring
  convention (e.g. left-align). Not justified by any current user
  requirement; documented here so future-us doesn't redo this analysis.

---

## Phase 4 — Client-side work reduction (proposed, not started)

The `/synteny` worker (`plugins/linear-comparative-view/src/LinearSyntenyRPC/
MultiPairGetFeatures.ts:104-108`) currently parses every feature's `cs`
string via `extractMismatchesFromCs` + `extractIndelsFromCs` before packing
the result into Uint32/Uint8 arrays for transfer. The server already has
the parsed information (it built `cs` in the first place from path-walk
intersections); it could emit `mismatchPositions`/`mismatchBases` arrays
directly, letting the worker skip the cs parse loop entirely on the
server-fed path.

Trade-offs to evaluate before pulling the trigger:

- **Worker path doesn't simplify uniformly**: the static-file
  `GfaTabixAdapter` will still produce cs (derived from CIGAR + bubble
  overlay), so the worker would need a conditional `feat.preParsed ?? parseCs(feat.cs)`.
  Net code is *not* smaller — only runtime work for the server adapter
  drops.
- **Wire format**: pre-decoded arrays are usually larger than cs strings
  for low-diff features (e.g. `:5000` = 5 chars vs 0 events ≈ 0 bytes
  either way, but `:5000*gc:5000` = 12 chars vs 1 entry × ~5 bytes for
  position+base). Net likely similar.
- **Profile first**: no evidence yet that cs parsing is a hotspot on
  volvox or HPRC. Server-fed HPRC chr20 features can be ~1 cs string of
  ~10⁵ chars per genome × ~90 genomes — that's the size where parsing
  could matter. Run the perf harness on chr20 with cs-parse-time
  instrumented before making the wire-format change.

Decision deferred until profiling data lands.

---

## Phase 4 — Perf

`test/perf-chr20.ts` times `/subgraph` and `/synteny` across 1kb, 10kb,
100kb, 1Mb regions.

### Baseline breakdown (HPRC chr20, 1.13 GB .og, 16-core box)

`odgi extract -i chr20.gfa.og -r path:start-end -c 1 -t 16 -o sub.og`
then `odgi view -i sub.og -g`:

| Region | extract | view -g |
|---|---|---|
| 1 bp | 6.4 s | 0.02 s |
| 10 kb | 8.5 s | 0.02 s |
| 100 kb | 9.3 s | 0.02 s |
| 1 Mb | 9.2 s | 0.02 s |

**view is free; extract dominates entirely.** ~6 s is fixed
(deserializing the 1.13 GB `.og` from disk into the in-memory ODGI
graph structure), ~3 s scales with region size. Even a 1-base extract
pays the full deserialize cost because `odgi extract` is a one-shot
binary — no resident-process mode in v0.9.4.

### vg find + xg index (alternative backend)

Built `chr20.xg` (1.5 GB) from `chr20.vg` via `vg convert -x`
(one-time, ~90 s). `vg find -x chr20.xg -p path:start-end -c 1 |
vg view -g`:

| Region | total | vs odgi |
|---|---|---|
| 1 bp | 0.7 s | **9× faster** |
| 10 kb | 0.9 s | **9× faster** |
| 100 kb | ~3–5 s (est.) | similar |
| 1 Mb | 25.8 s | **3× slower** |

`xg`'s memory-mapped succinct format avoids the full-graph deserialize
that dominates `odgi extract`. Wins on every small-region query
(≤100 kbp — the GraphGenomeView Bandage mode and per-synteny-tile
range); loses on >1 Mbp where the algorithmic cost of pulling many
haplotype walks dominates. Coarsened tiers from the static-file
preprocessor cover the >1 Mbp range, so the loss is in territory the
runtime backend isn't responsible for anyway.

W-line GFA output from `vg view -g` is compatible with
`parseExtractedGfa` (which already handles W-lines for GFAs that lack
P-lines).

### `backend: 'vg'` opt-in (landed 2026-05-12)

`datasets.json` accepts an optional `backend: 'odgi' | 'vg'`. The vg
path uses `vg find -x <xg> -p <region> -c <ctx> | vg view -g` and
`vg paths -L/-E` for the path enumeration in `/setup`. `.xg` is built
on-demand from `.vg`/`.gfa`/`.pg`/`.hg` (one-time cost, ~90 s on
chr20). `vg view -g` emits W-line GFAs — already handled by
`parseExtractedGfa`. PanSN parsing now recognises vg's bracket-style
subwalks (`CHM13#chr20[100864-26386516]`) alongside odgi's
colon-style (`CHM13#0#chr20:100864-26386516`). For W-line records
with `hapIdx="0"`, the parser emits a two-part PanSN name
(`sample#seqid`) so synteny lookups line up with the names that
`vg paths -L` returns at `/setup`.

End-to-end on HPRC chr20 with the vg backend:

| Endpoint | Cold | Cache hit |
|---|---|---|
| `/synteny` 10 kb | **0.91 s** (89 blocks, 90 paths) | 3 ms |
| `/synteny` 100 kb | **2.95 s** (99 blocks, 100 paths) | <10 ms |
| `/setup` (first call) | 37 s (one-time per process) | <5 ms |

(`/synteny` 10 kb was ~15 s on odgi pre-change. /setup was ~30 s on
odgi too — same order-of-magnitude path enumeration.)

### `/setup` paths-cache sidecar (landed 2026-05-13)

`buildSetup` now writes a `<index>.paths.json` sidecar after enumerating
paths via `odgi paths -Ll` / `vg paths -E`. On subsequent boots the cache
is loaded directly when its recorded `(file size, mtime)` matches the
index file, so a `(vg, chr20)` boot drops from ~55 s (cold) to ~100 ms
(warm). The sidecar invalidates automatically when the .og/.xg is
rebuilt because its mtime changes.

Outstanding:

- Run the chr20 perf harness end-to-end on vg via `BACKEND=vg pnpm exec
  node --experimental-strip-types tools/graph-server/test/perf-chr20.ts`
  and record numbers in `agent-docs/GRAPH_PERF.md`.
- `parseExtractedGfa` is not currently a hotspot — `extract` is 100×
  larger than parse+walk on chr20.

---

## Phase 5 — Documentation

- Update `tools/graph-server/CLAUDE.md` "Endpoints" section to document
  the bubble-CS algorithm (path-pair walk → alt-seq diff → cumulative cs).
- Add an ADR at `agent-docs/architecture-decision-records/adr-XXX-server-vs-tabix-parity.md`:
  - Why two backends.
  - Where CS derivation logic lives (server: `synteny.ts`; tabix:
    `bubbleOverlay.ts`). Risk: drift between them. Mitigation: Phase 3
    oracle test runs in CI on volvox.
  - Decision: server is the canonical bubble-CS implementation; tabix
    preprocessor mirrors the same algorithm. New CS features ship in
    server first, then port to the Rust preprocessor.

---

## Phase 6 — Graph view aesthetic (lowest priority)

Current bandage rendering shows many "pills" because each node gets
subdivided into `nodeSegmentLength=5` chunks, and every internal edge gets
an arrow. The user's reference image is a clean Bandage with one block
per segment.

- Plumb `nodeSegmentLength` through the `LaunchView-GraphGenomeView`
  extension point so callers can override per dataset.
- Try `nodeSegmentLength: 50` on volvox; check FMMM layout time and visual
  cleanliness. If layout is still <5s, raise the default.
- Per-segment color hashing for the Bandage style: each node gets a stable
  hue from its ord, segments of the same node share color.
- Note: this is a `plugins/graph` change, not a server change. Lower
  priority than Phase 1–3.

---

## Open questions

- Should bubble CS derivation move into `tools/gfa-to-tabix` (the Rust
  preprocessor) so the static-file path can drop the side `bubbles.bed.gz`
  index? Pro: smaller index, single algorithm. Con: forces Rust port of
  the JS sequence-diff code; the bubble file currently encodes per-sample
  presence vectors that don't fall out of pairwise CS — verify these are
  derivable from path-pair walk alone before consolidating.
- Should `GfaServerAdapter` cache `/setup` and recent `/synteny` responses
  in IndexedDB? Right now every cold tab load hits the server. Cheap to
  add if the server is the bottleneck; harmful if responses might change
  (e.g., during dev).
- Do we want a CLI for the graph-server (`@jbrowse/graph-server start ...`)
  for end-user installs, or keep it as a dev/researcher tool?

---

## Non-goals

These are explicitly out of scope for the graph-server path; they belong
to the static-file pipeline only:

- Coarsening tiers (`synteny.coarse.bed.gz`). The server is for
  interactive prototyping; offline preprocessing builds the tiers.
  See `feedback_static_file_coarsening`.
- CDN-friendly delivery (range-fetched static files). Server requires a
  live process; static files don't.
- Multi-tenant auth + rate limiting. See `tools/graph-server/CLAUDE.md`
  "Things that don't go in here."
