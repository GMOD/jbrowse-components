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

// Where the gate is told not to look. The default is 3%; a name listed here
// raises its own ceiling. Keyed by substring of the snapshot name (the
// targeted_ / fullpage_ prefix is included, so a bare base name matches both).
//
// **Every entry is a testable claim about why two backends disagree, and the
// list is audited by testing them.** These all said "antialiasing" — which
// predicts the drift MOVES when the rasterizer changes. So render the same build
// twice, once with `--swiftshader` and once on the real GPU, and compare:
//
//   identical to two decimals -> not rasterization. Something is drawn
//                                differently, and the ceiling is hiding it.
//   moves                     -> rasterization, and the entry is doing its job.
//
// Audited that way on 2026-08-04, with every threshold temporarily zeroed so the
// run prints each pair's exact drift. **Every pair came back identical across the
// two rasterizers, so no entry's stated reason survived** — and seven of the
// eight were also far under the 3% default and were deleted outright:
//
//   arcs-paired-end-rnaseq        10% ceiling, measured 0.02%
//   arcs-rnaseq-sashimi           10% ceiling, measured 0.01%
//   arcs-collapse-introns-sashimi  5% ceiling, measured 0.01%
//   inversion-indels              10% ceiling, measured 0.09%
//   workspaces-layout-url-param    8% ceiling, measured 0.00%
//   alignments-long-reads-sv-linked 10% ceiling, measured 1.99%
//   inversion-paired-coverage      8% ceiling, measured 2.22%
//
// The arc entries are the cautionary ones: they claimed a 6-8% analytic-curve
// floor and the arcs now agree to 0.02%, because the drawing changed under them
// and nobody re-measured. A stale override is worse than no override — those
// five views could have regressed by 10% in silence.
//
// So: an entry needs a measured number and a reason that survives the rasterizer
// test. Re-run the audit after any change to a shared draw path.
const DEFAULT_THRESHOLD = 0.03
const THRESHOLD_OVERRIDES: { match: string; threshold: number }[] = [
  // Dense simulated-long-read pileups + their coverage strip. This entry was
  // 20% and excused as "uniform edge shimmer over identically-shaped reads".
  // **That was wrong, and the ceiling was hiding two real bugs.** The drifts
  // were byte-identical on a real GPU and under swiftshader (16.71 / 7.97 /
  // 5.49 / 2.30) — AA noise cannot survive swapping the rasterizer, so the
  // backends were drawing different pixels.
  //
  // One is fixed: canvas2d anchored its sub-pixel minimum-width expansion at the
  // mark's LEFT edge while the shader's expandMinWidthX centers it, so every
  // coverage mark past 1bp/px sat half a pixel right of the GPU's. Centering the
  // canvas side took the worst pair 16.71% -> 7.32%.
  //
  // A second bug was found behind it and fixed too, for a smaller gain than
  // expected: TRIANGLE_H is 4.5, so the interbase bar's edges landed mid-pixel,
  // and the backends do not agree on a half-covered row — Canvas2D composites
  // each of the ~40 bars stacked in one column separately and saturates to
  // opaque, while the GPU resolves the union coverage once and stays at exactly
  // 50%. Snapping both edges to whole pixels took 7.32% -> 6.59%.
  //
  // What is LEFT is the same accumulate-vs-resolve difference on marks that
  // cannot be snapped: the SNP ticks and indicator triangles sit at arbitrary
  // sub-pixel x, ~40 deep per column at this zoom. Closing that means canvas2d
  // drawing one merged mark per pixel column instead of 40 overlapping
  // antialiased ones — a change to the drawing model, not an offset fix.
  //
  // 10%, above the measured 6.59%. This number should keep falling; it is a
  // record of what is still broken, not a setting.
  { match: 'inversion-pbsim', threshold: 0.1 },
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
//     agent-docs/reference/CROSS_BACKEND_GATE.md). They come back when that is
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
