---
name: handoff-multi-track-interaction-cost
description: Live state of the "several BAM tracks open at once" performance thread — what has landed, the three leads that remain with what each is blocked on, and the hypotheses already ruled out. The benchmarks that found all of it are named here; their numbers live in their own headers.
---

# Handoff: what N open BAM tracks cost

**Started** as "load the app with several bam files, measure interaction
slowness, profile it, and turn that into optimizations." Five fixes have landed.
This file holds the leads that have not, so neither they nor the refuted
hypotheses get re-derived.

## Why this was not already known

Every benchmark in `jb2bench` opened exactly **one** track, so every number it
had was a per-track cost measured in isolation. A real session has a stack.
`jb2bench/scripts/render/multibam.ts` sweeps the track count with region, zoom,
viewport, gesture and frame count held fixed; `labeldiag.ts` beside it pairs
each display's array sizes against how long one recompute takes and how many
labels come out.

## What landed

Each is its own commit, with the reasoning and the measurement in the message.
The benches carry their numbers in their headers, which is where to read them
from — `plugins/alignments/benches/` holds `modExtract.bench.ts`,
`modMenuScan.bench.ts` and `modCombinedCode.bench.ts`.

| | bench |
| --- | --- |
| `computeVisibleLabels` decided its walk from the data's longest feature | `labeldiag.ts` |
| the max-probability walk carries the ML byte, not an object per position | `modExtract.bench.ts` |
| the modifications menu is answered from the MM headers | `modMenuScan.bench.ts` |
| a combined code (`C+mh`) walks the read once per GROUP, not once per type | `modCombinedCode.bench.ts` |
| the palette UBO's four table walks resolve once, not per frame per track | — (~0.8% of one profile; pinned by `paletteUboParity.test.ts`) |
| `getNextRefPos` is driven by the positions, not by every read base | `cigarWalkShape.bench.ts` |

**The last one came from measuring the phases instead of recognizing a shape,
and that is the transferable part.** Three fixes here were each aimed at
something a reader could spot, which works until the next three candidates are
all aimed at the same phase on no evidence. `modPhases.bench.ts` splits the
per-read pipeline (parse 46%, CIGAR walk 45%, emit 10%) and redirected the queue
twice over: it found the walk, and it demoted the parse candidate that looked
obvious (`mmParseShape.bench.ts`, filed as declined) in favour of the one that
did not.

**And these benches moved to the file's full extent rather than a 19 kb window**,
which is not a detail: the small window is cache-resident, so it prices
arithmetic and is silent about allocation. Re-measuring the combined-code fix at
3.1x the size moved it 2.07x -> 1.86x. A window too small to hold the real
working set does not widen the error bars, it moves the answer — and here it
moved it in the direction that flattered the change.

The end-to-end A/B for the first three is committed in jb2bench as
`results/multibam-pan.{json,md}` (`752657f`). The number worth keeping from it is
not the ratio but the **shape**: after the label fix the frame median is the same
at four tracks and at six, where before it still grew. Behaviour was checked by
pixel diff, not only by tests — `jb2bench/scripts/render/pixelab.ts`.

## The leads, in the order I would take them

### 1. Re-profile the per-frame React/Emotion tax at N tracks

`jb2bench/results/interaction-cpu.md` established this on **one** track and
parked two directions (reposition overlays by CSS transform during a gesture;
hoist static styles out of per-frame render). What is new is that it is the
entire residual once the label walk is gone, and that it scales per track — each
track mounts its own overlay and chrome subtree.

**Blocked on a quiet machine, and now demonstrably so**: see the periodicity
section of [INTERACTION_PERF.md](../reference/INTERACTION_PERF.md), where the
same gesture profiles at 83% `(program)` with every worker idle. Attribution is
worthless in that state and the inflation is not uniform across frames.

### 2. Does a sixth alignment track want a sixth RPC worker?

`WorkerPoolRpcDriver` sizes the pool `clamp(detectHardwareConcurrency() - 1, 1, 5)`
and `rpcSessionId` is per-track, so tracks round-robin — and a six-track session
puts two of them on one worker. Testable in one line through the `workerCount`
config slot. The reason it is not obviously right is memory, not speed: each
worker holds its own BAM chunk caches and its own bgzf pool, so this wants the
measurement in [BGZF_WORKER_POOL.md](../reference/BGZF_WORKER_POOL.md) and
[ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md)'s per-context
entry, not a stopwatch.

### 3. The stop-token probe, for whoever finds it in a trace next

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
- **The multi-track pan does not refetch.** Every RPC worker profiles 100% idle
  through the gesture at six tracks, so the multibam numbers are re-render cost
  as the bench claims.
- **The 500 ms coarse tick's per-track repaint is warranted, not redundant.** The
  tick IS where the over-budget frames land, and both halves of "make it stop"
  are now closed: skipping the stats computation saves nothing (it is tens of
  microseconds) and suppressing the invalidation has no case to fire in (the
  stats changed at **every** tick for **every** display, 0 of 24).
  [INTERACTION_PERF.md](../reference/INTERACTION_PERF.md) has both, and what is
  left of that direction — stagger the tick, or make the repaint cheaper — folds
  into lead 1.
- **`computeReadBaseCounts` already early-outs** on an empty position set, so a
  track with no modification marks does not walk its reads for nothing.
- **Five measured negatives** are filed in
  [REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md): the boxed `number[]` of
  probabilities, columnar output in place of `ModificationEntry[]`, scanning the
  MM delta list instead of splitting it, and both memos on `coverageStats` — the
  compute one and the value-equality one.

## The modification path outgrew this thread

It started as lead 1 here and is now its own body of work, held in three places
rather than in this file: the benches in `plugins/alignments/benches/`
(`modPhases` for the phase split, then `cigarWalkShape`, `cigarOpDensity`,
`mmParseShape`, `modCombinedCode`, `multiGroupParse`), the
[MM/ML vs htslib cross-reference](../reference/MODIFICATION_TAGS.md), and two
TODO entries under "Measure first".

**What a reader needs from here is the corpus fact.** Every modification number
this repo had came from one single-group ONT-ish fixture, and when a real
multi-group one arrived (`jb2bench/shell/fetch_ont_6ma.sh`, ONT 6mA, 8,166 reads
/ 72.8 Mbp / 21.81M MM deltas) it moved three conclusions at once: the pipeline's
phase split (parse 46% -> 71%), the value of the change measured against it, and
— the one worth knowing — **what the data looks like at all.** Dorado emits 5mC
and 5hmC as two separate MM groups on C, not the combined `C+mh` a landed commit
message here called "the standard output of anything calling hydroxymethyl".

Three claims from this thread were retracted by later measurement, each recorded
beside the thing it corrected: that a 19 kb window was representative, that the
cursor walk's ratio was capped by op density, and that combined codes are what
multi-type basecallers emit. The pattern in all three is a plausible mechanism
quoted with the confidence of a measurement.

## One thing about the machine

Every browser timing in this thread was taken on a box shared with ~10 agent
sessions, at load 8-42 against the 1.5-2.9 a clean run wants. The node benches
(interleaved, min-of-rounds, with a control) hold up under that and their
controls prove it; **the browser numbers do not, and the failure is not just
width.** A frame spike measured here is the machine's descheduling as much as the
code's work, so quote periods and shapes from browser runs and absolutes only
from node. `jb2bench`'s README and
[BENCHMARKING.md](../reference/BENCHMARKING.md) have the long version.
