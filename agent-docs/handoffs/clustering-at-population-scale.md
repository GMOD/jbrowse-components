---
name: clustering-at-population-scale
description: A read-only review of the in-app clustering path, nothing committed — the WebGPU distance kernel is still unwired (the probe is its only caller), the input matrix is copied three times so the 1 Mb phased shape wants ~1.45 GB before the distance build starts, and the "integer dosages" premise behind ideas/gpu-sample-distance-matrix.md does not hold for the shipped encoder. Waiting on a second reader to confirm the copy chain and the fractional-dosage correction before either is filed into that idea or acted on.
---

# Clustering at population scale: handoff

A read-only review, 2026-09-07. **Nothing landed and no file changed** — this
worktree holds only this doc. Four findings, two of which contradict the parked
proposal in
[ideas/gpu-sample-distance-matrix.md](../ideas/gpu-sample-distance-matrix.md),
which is why they are sitting here rather than being edited into it.

The question that started it was narrow ("is the WebGPU clustering wired up, and
does it break past some size"). Finding 1 answers it. Findings 2 and 3 are what
turned up on the way and are the reason the answer to "so what do we do" is not
"wire the kernel".

Permanent homes, so this file does not restate them: the workflow is
[reference/CLUSTERING_WORKFLOW.md](../reference/CLUSTERING_WORKFLOW.md), the
measured GPU-vs-wasm timings are
[measurements/cluster-distance-gpu.json](../measurements/cluster-distance-gpu.json)
and the table generated from it in the idea doc. **No measurement is published
here.** The byte counts below are arithmetic from N and V against allocations
you can read in the source, not a new record — anyone can redo them on paper,
and if they want to become a record they belong in the idea doc's generated
block, not in a handoff.

## 1. The kernel is not wired (low stakes, easy to confirm)

`products/jbrowse-web/browser-tests/probe-gpu-distance-matrix.ts` is the only
thing in the tree that contains the distance kernel, and nothing references it
but prose — `agent-docs/ideas/gpu-sample-distance-matrix.md:189` and
`reference/CLUSTERING_WORKFLOW.md:233`. No package script, no CI job.

All four clustering RPCs still end at
[`clusterMatrix`](../../packages/tree-sidebar/src/clusterMatrix.ts) (`:57`) →
`clusterData` from `@gmod/hclust` 5.1.0, wasm, on the RPC worker.

What **is** wired is the LD matrix —
`plugins/variants/src/VariantRPC/getLDMatrixGPU.ts` (`MIN_WORK` at `:21`),
`ldDispatchPlan.ts`, `ldGpuSpotCheck.ts`. That is the scaffolding any clustering
kernel should copy, and it proves WebGPU compute works from inside the RPC
worker.

The stated blocker is unchanged and still true: `ClusterOptions` in
`@gmod/hclust` 5.1.0 (`esm/types.d.ts`) accepts only `data`, with no entry that
takes a precomputed distance matrix.

## 2. The input matrix is copied three times — this is the real ceiling

Not in the idea doc at all, and it is the finding I most want a second reader
on, because it reorders the whole plan.

Three live-simultaneously allocations of **N·V·4**:

- the builders' rows, `Map<string, Float32Array>` from
  `getGenotypeMatrix.ts` / `getPhasedGenotypeMatrix.ts`
- `esm/wasm-wrapper.js:20` — `new Float32Array(numSamples * vectorSize)` plus a
  per-row `.set()`
- `esm/wasm-wrapper.js:24,30` — `_malloc` then `HEAPF32.set(flatData, …)`

plus **N²·4** for the distance matrix the C allocates. (`imputeMissingToSiteMean`
at `genotypeMatrixEncoding.ts:119` mutates in place and is *not* a fourth copy —
worth confirming, it reads that way to me.)

On the shapes the idea doc's own table measures:

| window | N | V | 3 × N·V·4 | N²·4 | peak |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 Mb, MAF 0, samples | 2,504 | 22,514 | 676 MB | 25 MB | ~700 MB |
| 1 Mb, MAF 0, haplotypes | 5,008 | 22,383 | 1.35 GB | 100 MB | **~1.45 GB** |

The bottom row is the shape where the GPU buys the most — 98 s → 8.2 s. So
wiring the kernel there converts a 98-second hang into an 8-second one *on a run
that needs 1.45 GB in the worker before the distance build starts*, and the GPU
path only adds to the peak (an `n*n*4` readback buffer at
`probe-gpu-distance-matrix.ts:185` plus its `.slice(0)`).

**Hence the ordering claim I want checked: the copies gate the kernel, not the
reverse.** Collapsing them is GPU-independent, and until it happens the kernel's
best case is a faster route to the same OOM.

The in-tree half is cheap — have the builders allocate one flat
`Float32Array(N*V)` and hand out `subarray` row views, which leaves the
`Map<string, Float32Array>` contract and every consumer (hclust, the R export,
the TSV export) untouched. The other two copies need hclust to accept a flat
buffer. The ambitious version, hclust exposing the `_malloc`'d `HEAPF32` view so
the builder fills the wasm heap directly, is 3 copies → 1, but the API has to
say that the heap must not grow during the fill or the view detaches. **Is that
worth the sharp edge, or is 3 → 2 the right stopping point?**

## 3. "Integer dosages" is not what the shipped encoder emits

The idea doc rests a correctness argument on this, twice — "for 0/1/2 dosages
the f32 partial sums are exact, which is why the check came out at zero", and
the §"Row ordering at MAF scale" conclusion that fractional drift is the *MAF*
path's problem while the variant path is safe.

`genotypeMatrixEncoding.ts` looks to me like it breaks that premise three ways
on the variant path, all by design and all documented in its own comments:

- `readAltDosages` (`:62`) writes `2 * calls / called` (`:108`), so a polyploid
  `0/1/1` is 1.33 — the comment says so explicitly
- multiallelic sites split across one slot per ALT
- `imputeMissingToSiteMean` (`:119`) writes a site *mean* at every no-call, and
  `executeClusterGenotypeMatrix.ts` calls it unconditionally before hclust

If that reading is right, fractional values are the norm on any real panel
rather than an edge case, the measured drift (3.6e-5 relative at V = 20,000) is
in scope for the variant path, and a GPU kernel there needs the promote-every-16
accumulation and a parity test built on *fractional* input from the start — not
deferred with the MAF path.

**This is the finding I am least sure of and it is the one that matters most**,
because it is a correction to a doc that will otherwise be read as settled. It
turns on whether real panels carry enough no-calls / multiallelics / non-diploid
calls for the drift to reach a merge decision, which I did not measure. A second
reader who knows the panels should say whether the premise is merely imprecise
or actually wrong.

## 4. No size guard anywhere, and hclust's OOM message under-reports

`MIN_CLUSTER_ROWS = 2` (`clusterMatrix.ts:39`) is the only check on the path.
`MAX_COLUMNS = 5000` (`plugins/maf/src/LinearMafClusterIdentityRpc/buildIdentityMatrix.ts:33`)
is columns, MAF path only. Nothing caps rows, and nothing weighs N against V.
Today the feedback for an oversized run is a dead worker or a multi-minute
freeze.

The three dialogs (`MultiSampleVariantClusterDialog`, `WiggleClusterDialog`,
`MafClusterDialog`) all wrap one shared `ClusterDialog`, so there is a single
place to put a guard.

Separately, `wasm-wrapper.js:62-64` reports only `numSamples² * 4` on the
out-of-memory path — 0.10 GB on a run whose actual peak is ~1.45 GB, a 14x
under-report that will send whoever reads it after the wrong allocation. That is
an upstream fix and it is independent of everything else here.

Note for whoever writes the guard: the count belongs in the dialog body, not in
a live menu label — a control names its subject.

## What a second opinion is actually being asked for

In the order I would want them answered:

- **Is the three-copy chain real, and does the ordering follow from it?** If yes,
  steps 2 and 3 below are the work and the kernel is a later, separate decision.
  If I have miscounted a copy, most of this doc collapses.
- **Is finding 3 a correction to the idea doc or just a caveat on it?** Depends
  on real-panel no-call and multiallelic rates, which I did not measure.
- **Is a 2504/5008-sample panel a target we ship?** I found `test_data/1000g_cnv/`
  and a 1000 Genomes mention in `products/jbrowse-web/src/components/NoConfigMessageSampleData.ts`,
  but no shipped 2504-sample genotype panel. Below that scale the kernel is
  already measured as a loss (167 dogs: 16 ms CPU vs 18 ms dispatch) or declined
  (464 haplotypes: 1.7–2.2x). **If the answer is no, findings 1 and 3 are moot
  and only 2 and 4 are worth doing.**
- **3 copies → 2, or → 1 with the detach hazard?**

## The plan those answers would confirm or kill

Sketch only — nothing here is committed, and the order is the argument:

- **Guard + honest OOM message** (finding 4). Ships alone, no upstream
  dependency, removes the worst failure mode.
- **Collapse the copies** (finding 2). In-tree flat buffer + `subarray` views;
  upstream hclust accepting the flat buffer.
- **Upstream: the precomputed-distance entry.** Hard prerequisite for any GPU
  work, independently useful, and the C already splits the phases.
- **Then, and only if the panel question says yes, the kernel** — with the
  LD-style scaffolding: band the output rather than allocating the full `n*n*4`
  (the kernel already early-returns on `j < i` at
  `probe-gpu-distance-matrix.ts:122`, so taking the triangle halves it and lifts
  the ~N≈5792 cap a spec-floor `maxStorageBufferBindingSize` imposes), a
  `planLDDispatch`-style refusal before any buffer is created, the `MIN_WORK`
  gate so dog10k stays on the CPU, and finding 3's accumulation and parity test.

## Checking the claims

```sh
# 1 — the kernel has no caller but prose
rg -l 'probe-gpu-distance-matrix' --glob '!node_modules'
rg -n 'clusterData|clusterMatrix' packages/tree-sidebar/src/clusterMatrix.ts

# 2 — the three copies, in order
sed -n '18,32p' node_modules/.pnpm/@gmod+hclust@5.1.0/node_modules/@gmod/hclust/esm/wasm-wrapper.js
sed -n '119,150p' plugins/variants/src/VariantRPC/genotypeMatrixEncoding.ts   # in-place?

# 3 — the fractional dosages
sed -n '62,115p' plugins/variants/src/VariantRPC/genotypeMatrixEncoding.ts
rg -n 'imputeMissingToSiteMean' plugins/variants/src/VariantRPC/executeClusterGenotypeMatrix.ts

# 4 — the guard that is not there, and the message that misreports
rg -n 'MIN_CLUSTER_ROWS|MAX_COLUMNS' --glob '!node_modules' --glob '!esm/'
sed -n '60,66p' node_modules/.pnpm/@gmod+hclust@5.1.0/node_modules/@gmod/hclust/esm/wasm-wrapper.js
```

The kernel itself needs headed Chrome (headless has no WebGPU):
`node browser-tests/probe-gpu-distance-matrix.ts 5008 22383` in
`products/jbrowse-web`, and `--fractional` for the finding-3 shape.

## Not in question

Settled by the idea doc, do not re-derive: the GPU-vs-wasm timings and the 12–19x
at population scale; that dog10k and the 464-haplotype MAF path do not want the
kernel; that `MAX_COLUMNS` at 5000 is correctly priced; that storage buffers rule
out a WebGL fallback.

## Closing this thread

Per [the index](README.md), the remainder gets filed and this file deleted — it
does not accumulate. Expected destinations: findings 2 and 3 into
[ideas/gpu-sample-distance-matrix.md](../ideas/gpu-sample-distance-matrix.md)
(finding 3 as a correction to its accumulation section, finding 2 as the
prerequisite ahead of its "What integrating it takes"); finding 4 into
[TODO.md](../TODO.md) as the guard plus the upstream message; finding 1 needs no
home, it is just the current state.
