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
// Run this by hand (`pnpm test:browser:gate`) when touching a shader or a
// backend. It no longer runs in CI: it was non-blocking, so it only ever
// published drift logs nobody read, while costing a build plus a two-backend
// render of every suite per push (removed 2026-07-16). Note it is a
// *differential* oracle — it is blind to a bug both backends share, so it would
// not have caught either real render bug found on 2026-07-16 (a stale mobx read
// in the breakpoint overlay, and GC content rendering empty). See
// browser-tests/README.md for what making it a blocking gate would take.
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
  let compared = 0
  let skipped = 0
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
      skipped++
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
  return { failures, drifts, compared, skipped, excluded, diffDir }
}
