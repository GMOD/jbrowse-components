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
// process). This is the CI-facing counterpart to compare-backends.ts, which
// diffs the committed per-backend snapshot dirs for local visual review.
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
// the inversion suite twice with 0 drift), so the sort/layout is stable when the
// input is. Pileup row assignment (placeRect, lowest-free-row) is arrival-order-
// sensitive, so whatever rarely perturbs read order between the two processes —
// unisolated; likely worker block-fetch completion order or a progressive-render
// settle race — reshuffles the whole stack into a big pixel diff. Rare, but a
// ~1% false-positive rate still can't be a differential oracle. The gate is clean
// for the deterministic view types (synteny/wiggle/dotplot/bigwig/variants/gwas/
// hic/genes), which held 0 false positives across all runs. Listed views are the
// ones observed; treat as representative, not exhaustive — the class is "pileup".
// Emptied after the morph-idle capture wait (snapshot.ts waitForMorphIdle) was
// believed to address the root cause. It does not, for the views in this class:
// waitForMorphIdle only waits on `morphFromTops`, which lives on
// LinearBasicDisplay (canvas feature tracks). LinearAlignmentsDisplay has no
// such property, so the wait is vacuous for exactly the pileups that drift.
//
// Still reproducible on 2026-07-16 against committed goldens: the same build
// re-run back to back failed a *different* subset each time (3 pileups at
// 10.29/21.55/11.04%, then 2 at 20.76/11.04%). Different subset + different
// percentages + identical inputs is the arrival-order race described above, so
// regenerating these goldens does not help — the next run re-drifts a different
// pileup. Anyone reviving a blocking gate (or trusting a pileup golden) has to
// isolate that race first, or re-populate this list with 'pileup'-class names.
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
