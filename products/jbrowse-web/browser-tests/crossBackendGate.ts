import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { comparePngBuffers } from './pngDiff.ts'

import type { Buffer } from 'node:buffer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const diffDir = path.resolve(__dirname, '__snapshots__', 'backend-diffs')

// Cross-backend differential gate. canvas2d and the GPU backends (webgl/webgpu)
// are independent implementations of the same drawing, so when they disagree on
// the same run one of them is wrong — a correctness oracle that needs no
// committed golden and so has no cross-machine drift (both renders happen in one
// process). Its counterpart is compare-backends.ts, which diffs the committed
// per-backend snapshot dirs for local visual review.
//
// Two ways to run it, both under swiftshader (drop `--swiftshader` from either
// to exercise the machine's real GPU):
//
//   pnpm test:browser:gate      every local suite — by hand, when touching a
//                               shader or a backend
//   pnpm test:browser:gate:ci   CI_GATE_SUITES, remote off — what the blocking
//                               `cross_backend_gate` push job runs
//
// It ran non-blocking over every suite until 2026-07-16 and was removed
// (f3cb3b962b) because it only published drift logs nobody read while costing a
// build plus a two-backend render per push. It is back as of 2026-08-04 with
// the two things that were missing: a verdict that counts, and a scope narrow
// enough for that verdict to be trustworthy (CI_GATE_SUITES below).
//
// Note it is a *differential* oracle — it is blind to a bug both backends share,
// so it would not have caught either real render bug found on 2026-07-16 (a
// stale mobx read in the breakpoint overlay, and GC content rendering empty).
// The committed goldens are the other half, and they still only refresh by hand.
//
// Captures are collected in memory during a multi-backend run (see
// recordCapture, tapped from snapshot.ts) and compared pairwise once every
// backend has rendered.

// name -> backend -> captured PNG bytes for this run
const captures = new Map<string, Map<string, Buffer | Uint8Array>>()
let collecting = false

export function enableCrossBackendCollection() {
  collecting = true
}

export function recordCapture(
  name: string,
  backend: string,
  png: Buffer | Uint8Array,
) {
  if (!collecting || !backend) {
    return
  }
  let byBackend = captures.get(name)
  if (!byBackend) {
    byBackend = new Map()
    captures.set(name, byBackend)
  }
  byBackend.set(backend, png)
}

// Inherent backend disagreement that is NOT a bug: analytic-curve / MSAA arc
// paths rasterize differently in the GLSL shaders than in canvas2d's arc
// rasterizer. Measured webgl-vs-canvas2d floor: flat fills and discrete geometry
// 0-2%, antialiased curves 6-8% (targeted). The default gate is 3%; these named
// views raise it. Keyed by substring of the snapshot name (the targeted_ /
// fullpage_ prefix is included, so a bare base name matches both).
const DEFAULT_THRESHOLD = 0.03
const THRESHOLD_OVERRIDES: { match: string; threshold: number }[] = [
  // antialiased analytic-curve arc paths (GLSL vs canvas2d arc rasterizer)
  { match: 'arcs-paired-end-rnaseq', threshold: 0.1 },
  { match: 'arcs-rnaseq-sashimi', threshold: 0.1 },
  { match: 'arcs-collapse-introns-sashimi', threshold: 0.05 },
  // dense simulated-long-read pileups + their coverage strip: uniform edge
  // shimmer over identically-shaped reads (measured 11-17%, coverage inflated by
  // a 45px-tall image). matches inversion-pbsim / -linked / -coverage.
  { match: 'inversion-pbsim', threshold: 0.2 },
  // coverage histograms whose SNP/mismatch ticks are 1px-edge sensitive
  { match: 'inversion-paired-coverage', threshold: 0.08 },
  // 1px-tall linked-read mate connectors land a row apart between backends
  { match: 'alignments-long-reads-sv-linked', threshold: 0.1 },
  // ruler chevrons + glyph AA across a three-view workspace layout
  { match: 'workspaces-layout-url-param', threshold: 0.08 },
  // sparse fullpage (short indel track + whitespace) where the always-present
  // full-width chevron-ruler AA dominates the pixel fraction; swiftshader
  // rasterizes the chevrons/gridlines a hair off canvas2d (measured 8.5%).
  { match: 'inversion-indels', threshold: 0.1 },
]

function thresholdFor(name: string) {
  const override = THRESHOLD_OVERRIDES.find(o => name.includes(o.match))
  return override ? override.threshold : DEFAULT_THRESHOLD
}

// Alignment PILEUP views intermittently disagree across the two independent
// browser processes — a *rare* (~1-2 of 155 pairs per run) race, a different
// pileup each run (across three runs: inversion-indels 8%, multiregion-strand-
// sorted 27%, inversion-simple-cram 25%, session-spec cram-pileup 7%; NO
// non-pileup view ever drifted). It is NOT gross nondeterminism: same-backend
// re-renders reproduce byte-for-byte (verified: canvas2d and webgl each rendered
// the inversion suite twice with 0 drift), so the layout is stable when the
// input is. Still reproducible on 2026-07-16 against committed goldens: the same
// build re-run back to back failed a *different* subset each time. Rare, but a
// ~1% false-positive rate still can't be a differential oracle.
//
// Pileup row assignment (placeRect, lowest-free-row) is order-sensitive, so
// anything perturbing read placement order reshuffles the whole stack. One such
// input was closed on 2026-07-22 — sortLayout.ts comparators left ties to array
// position, and every placement order now ends in a total tiebreak
// (compareReadsCanonically). That was a real defect, but do NOT assume it
// explains this drift: nothing was ever shown to reorder reads between runs
// (@gmod/bam walks chunks sequentially, CRAM record order is deterministic).
// Unexplored: the read SET differing between runs, and capture timing — note
// snapshot.ts waitForMorphIdle is vacuous here, since morphFromTops lives on
// LinearBasicDisplay, not LinearAlignmentsDisplay.
//
// The gate is clean for the deterministic view types (synteny/wiggle/dotplot/
// bigwig/variants/gwas/hic/genes) — 0 false positives across all runs.
const EXCLUDED_SUBSTRINGS: string[] = []

function isExcluded(name: string) {
  return EXCLUDED_SUBSTRINGS.some(s => name.includes(s))
}

// The suites the blocking CI job renders (`--ci-gate`). Exact suite names, not
// substrings, and the runner fails if one no longer matches a discovered suite:
// a gate that quietly compares less is the one failure mode a blocking gate
// cannot have, and a renamed suite dropping out of CI while everything stays
// green is exactly that.
//
// Two criteria, both load-bearing:
//
//   - **Local data only.** The remote suites (grape/peach, hs1/mm39,
//     GWAS LocusZoom LD, Demo Inventory) fetch from S3/UCSC at runtime, so they
//     would make every push depend on someone else's uptime. `--ci-gate` forces
//     remote off rather than trusting this list to stay in sync.
//   - **No alignments pileups.** Every over-threshold failure ever recorded here
//     has been an alignments view, and the drift is a capture-timing race rather
//     than a shader disagreement (see the comment above and
//     agent-docs/handoffs/cross-backend-gate-ci.md). They come back when that is
//     fixed, not before — one flaky suite is enough to get a blocking job
//     switched off, which is how this check ended up decoration the first time.
//
// Measured under swiftshader (the CI configuration) 2026-08-04: three
// consecutive clean runs, 106 tests and 66 pairs each, 0 over threshold, worst
// passing drift 0.51% against a 3% default — and byte-identical drift figures
// across every run. That headroom is the argument for blocking: these views are
// nowhere near their thresholds.
//
// The list is meant to grow as more view types are shown clean; growing it is a
// measurement, not an edit.
export const CI_GATE_SUITES = [
  'Additional Track Types',
  'BasicLinearGenomeView',
  'BigWig Tracks',
  'Dotplot View',
  'GWAS Tracks',
  'HiC Track',
  'MAF Track',
  'Miscellaneous Tracks',
  'Multi-Way Synteny Views',
  'Synteny Views',
  'Variants Track',
  'Wiggle Color Change',
]

// Which backend pairs to compare for one snapshot. canvas2d is the reference
// implementation, so compare it against each GPU backend present; if canvas2d
// wasn't captured (e.g. filtered out) fall back to every available pair.
function backendPairs(backends: string[]): [string, string][] {
  if (backends.includes('canvas2d')) {
    return backends
      .filter(b => b !== 'canvas2d')
      .map(b => ['canvas2d', b] as [string, string])
  }
  const pairs: [string, string][] = []
  for (let i = 0; i < backends.length; i++) {
    for (let j = i + 1; j < backends.length; j++) {
      pairs.push([backends[i]!, backends[j]!])
    }
  }
  return pairs
}

export interface GateFailure {
  name: string
  pair: string
  detail: string
}

interface Drift {
  name: string
  pair: string
  pct: number
  threshold: number
}

// Compare every collected snapshot across its backend pairs, writing a visual
// diff PNG for each failure. Returns the failures (empty = gate passes), the
// per-pair drifts sorted worst-first (so the caller can always print the margin
// — the highest *passing* drift reveals how close the noise floor sits to the
// threshold across CI runners), and counts. A snapshot captured by only one
// backend is skipped, not failed — it simply wasn't cross-checked this run.
export function runCrossBackendGate() {
  const failures: GateFailure[] = []
  const drifts: Drift[] = []
  // Named, not just counted. A snapshot only one backend captured is skipped
  // rather than failed, so the skip list IS the gate's coverage loss — and a
  // bare count leaves you unable to tell a structurally single-backend test
  // (gpu-quirks' WebGL-only context-loss case) from one that timed out on one
  // side this run. The count moved 15/33/14 across three runs on 2026-08-04
  // and there was no way to see what had gone missing.
  const skippedNames: string[] = []
  let compared = 0
  let excluded = 0

  for (const [name, byBackend] of [...captures].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (isExcluded(name)) {
      excluded++
      continue
    }
    const backends = [...byBackend.keys()].sort()
    if (backends.length < 2) {
      skippedNames.push(`${name} (only ${backends.join('/') || 'none'})`)
      continue
    }
    const threshold = thresholdFor(name)
    for (const [a, b] of backendPairs(backends)) {
      const diff = comparePngBuffers(byBackend.get(a)!, byBackend.get(b)!)
      compared++
      const pair = `${a} vs ${b}`
      if (diff.sameSize) {
        drifts.push({ name, pair, pct: diff.diffFraction * 100, threshold })
      }
      const overThreshold = diff.sameSize && diff.diffFraction > threshold
      if (!diff.sameSize || overThreshold) {
        fs.mkdirSync(diffDir, { recursive: true })
        if (diff.sameSize) {
          fs.writeFileSync(
            path.join(diffDir, `${a}-vs-${b}-${name}.diff.png`),
            diff.diffImage,
          )
        }
        failures.push({
          name,
          pair,
          detail: diff.sameSize
            ? `${(diff.diffFraction * 100).toFixed(2)}% drift (threshold ${(threshold * 100).toFixed(0)}%)`
            : `size differs (${diff.widthA}x${diff.heightA} vs ${diff.widthB}x${diff.heightB})`,
        })
      }
    }
  }

  drifts.sort((x, y) => y.pct - x.pct)
  skippedNames.sort()
  return {
    failures,
    drifts,
    compared,
    skipped: skippedNames.length,
    skippedNames,
    excluded,
    diffDir,
  }
}
