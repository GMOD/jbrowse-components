---
name: handoff-multi-track-interaction-cost
description: Live state of the "several BAM tracks open at once" performance thread — the three fixes that landed with their measurements, the six leads that did not, and the four hypotheses that were checked and ruled out. The benchmark that found all of it lives in jb2bench and is named here.
---

# Handoff: what N open BAM tracks cost

**Started** as "load the app with several bam files, measure interaction
slowness, profile it, and turn that into optimizations." Three fixes landed.
This file holds the leads that did not, and the ruled-out hypotheses, so neither
gets re-derived.

## Why this was not already known

Every benchmark in `jb2bench` opened exactly **one** track, so every number it
had was a per-track cost measured in isolation. A real session has a stack.
`jb2bench/scripts/render/multibam.ts` sweeps the track count with region, zoom,
viewport, gesture and frame count held fixed; `labeldiag.ts` beside it pairs
each display's array sizes against how long one recompute takes and how many
labels come out.

First result, six BAM tracks at `chr22_mask:124000-143000`, pan, unpaced frames:
frame median **2.5 ms at one track, 12.4 ms at six**, 5% of frames over 20 ms —
and 19.5% of the whole main-thread profile was one function.

## What landed

| | measurement |
| --- | --- |
| `computeVisibleLabels` decides its walk from the data's longest feature | 1.5M array entries per frame emitting **zero** labels |
| the max-probability walk carries the ML byte, not an object per position | **4.01x** (781 -> 195 ms), control 0.994 |
| the modifications menu is answered from the MM headers | **127.31 -> 0.22 ms**, control 1.026 |

End to end, two builds interleaved within each pass so both arms see the same
machine (2026-08-14, load 15-16, which is why these are ratios and not
absolutes):

| tracks open | before | after | | over budget |
| ---: | ---: | ---: | --- | --- |
| 4 | 12.6 ms | 4.9 ms | 2.57x | 5% -> 2% |
| 6 | 15.7 ms | 4.9 ms | **3.20x** | 22% -> 1% |

The number worth keeping is not the ratio but the **shape**: after the fix the
frame median is the same at four tracks and at six, where before it still grew.
The label walk was the part of the per-frame cost that scaled with the number of
open tracks.

Each is in its own commit with the reasoning; the benches are
`plugins/alignments/benches/modExtract.bench.ts` and `modMenuScan.bench.ts`,
which carry their numbers in their headers. Behaviour was checked by pixel
diff, not only by tests — `jb2bench/scripts/render/pixelab.ts`, zero differing
pixels across three tracks.

## The leads, in the order I would take them

### 1. A combined modification code walks the read once per type — measured, ready

`getModPositions` keeps the whole delta walk inside `processType`, which is
called once per character of a multi-char lowercase type string. `C+mh` — ONT's
5mCG_5hmCG model, and the standard output of anything calling hydroxymethyl —
therefore walks the read sequence **twice** and allocates two identical position
arrays. Only `probStart` differs between them.

Interleaved, min of 20 rounds, 285 MM reads of `200x.longread.mod.bam`, against
a variant that hoists the walk to the group and shares one array:

| tag | shipped | hoisted | |
| --- | ---: | ---: | --- |
| `C+m` (1 type) | 89.94 ms | 75.98 ms | 1.18x, control 1.019 |
| `C+mh` (2 types) | 174.86 ms | 79.27 ms | **2.21x**, control 1.000 |

Output identical. The shape is the argument: shipped nearly doubles when a
second type joins the same tag while hoisted stays flat — O(types) becomes
O(1). **Our corpus is single-type**, so no benchmark in either repo sees this;
the combined tag has to be synthesized by rewriting `C+m?,` to `C+mh?,` on the
existing reads, which leaves every position unchanged.

`forEachMaxProbMod` has the same duplication one layer down — it walks the CIGAR
once per mod entry, and a combined code's entries carry identical positions.
Sharing the array by identity is what makes grouping those walks possible, so
take the two together.

### 2. The 500 ms coarse update is a thundering herd

`coverageStats` reads `coarseDynamicBlocks` deliberately, so the per-bp depth
rescan is ~2x/sec rather than per frame — but **every open track rescans on the
same tick**, and `SearchBox` re-renders its whole subtree (a MUI Autocomplete
included) on that same tick. That is the p99 shape the sweep shows: 46-55 ms
spikes against 3-12 ms medians.

First move is to confirm the coincidence rather than assume it — the frame
timestamps are already recorded per pass, so check whether the over-budget
frames land on a 500 ms grid. If they do, memoizing `computeVisibleCoverageStats`
per `(rpcData, block range)` catches most of it, since coarse blocks repeat while
panning.

### 3. Re-profile the per-frame React/Emotion tax at N tracks

`jb2bench/results/interaction-cpu.md` established this on **one** track and
parked two directions (reposition overlays by CSS transform during a gesture;
hoist static styles out of per-frame render). What is new is that it is the
entire residual once the label walk is gone, and that it scales per track — each
track mounts its own overlay and chrome subtree.

Blocked on a quiet machine: the profile that says so was taken at load 42, where
`(program)` is inflated and every attribution with it.

### 4. The palette UBO is rebuilt every frame, every region, every track

`GpuAlignmentsRenderer`'s `writeUniforms` calls `writePaletteToUbo`, whose loop
header is `Object.entries(PALETTE_UNIFORM_FIELDS)` — a fresh array of pairs per
call. A module-level pre-resolved array of `[uboIndex, paletteKey]` is a
mechanical fix. Small (~0.8% of one profile) and free.

The tempting larger version — memoize the whole palette block on `state.colors`
identity — needs care: the five base slots are overwritten afterwards from
`effectiveBaseColors(state)`, and that file's own comment warns that a uniform
slot left unwritten keeps whatever the last block render put there.

### 5. Does a sixth alignment track want a sixth RPC worker?

`WorkerPoolRpcDriver` sizes the pool `clamp(detectHardwareConcurrency() - 1, 1, 5)`
and `rpcSessionId` is per-track, so tracks round-robin — and a six-track session
puts two of them on one worker. Testable in one line through the `workerCount`
config slot. The reason it is not obviously right is memory, not speed: each
worker holds its own BAM chunk caches and its own bgzf pool, so this wants the
measurement in [BGZF_WORKER_POOL.md](../reference/BGZF_WORKER_POOL.md) and
[ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md)'s per-context
entry, not a stopwatch.

### 6. The stop-token probe, for whoever finds it in a trace next

`probeBlobUrl` is a **synchronous XHR** per throttled check and was 408 ms
across six tracks' cold load. The cheap path is the `SharedArrayBuffer` branch,
which needs COOP/COEP cross-origin isolation — which a browser fetching
arbitrary remote BAMs over CORS probably cannot require of its host page.
`stopToken.ts`'s own header says the probe was deleted once and had to be
restored. Recorded so the next person recognises it and moves on.

## Ruled out — do not re-derive

- **Tracks do not serialise on one RPC worker.** `rpcSessionId` is per-track
  (`BaseTrackModel`, keyed on the adapter config), and the pool round-robins.
- **Coverage stats are not recomputed per frame.** The getter reads
  `coarseDynamicBlocks` on purpose and says so.
- **`computeReadBaseCounts` already early-outs** on an empty position set, so a
  track with no modification marks does not walk its reads for nothing.
- **Two measured negatives** on the modification path are filed in
  [REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md): the boxed `number[]` of
  probabilities, and columnar output in place of `ModificationEntry[]`.

## One thing about the machine

Every browser timing here was taken on a box shared with ~10 agent sessions, at
load 8-42 against the 1.5-2.9 a clean run wants. The node benches (interleaved,
min-of-rounds, with a control) hold up under that and their controls prove it;
the browser numbers are ratios measured back-to-back and should not be quoted as
absolutes. `jb2bench`'s README has the long version of why.
