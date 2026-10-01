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
// Two ways to run it, both under swiftshader:
//
//   pnpm test:browser:gate      every local suite — by hand, when touching a
//                               shader or a backend
//   pnpm test:browser:gate:ci   CI_GATE_SUITES, remote off — what the blocking
//                               `cross_backend_gate` push job runs
//
// To exercise the machine's real GPU add `--real-gpu`. **Not** by dropping
// `--swiftshader`, which is what this comment used to say: headless Chrome does
// not select a GPU on its own and you get SwiftShader either way (measured,
// `probe-renderer.ts`). The distinction is the whole rasterizer test below.
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

// Drop every capture so the next pass starts from nothing. The gate's retry
// re-renders the whole run rather than the implicated tests: with CONCURRENCY
// tests in flight at once there is no module-global "current test" to key a
// capture to its producer, and threading that identity from runSuites down
// through dualSnapshot -> canvasSnapshot -> compareImages to recordCapture is a
// lot of plumbing for a path that only runs when the gate was going to fail
// anyway.
export function clearCaptures() {
  captures.clear()
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

// Substring of the snapshot name (targeted_/fullpage_ prefix included) ->
// raised ceiling. Each entry is a claim the rasterizer test checks; the rule
// and the audit are in agent-docs/reference/CROSS_BACKEND_GATE.md
// §"Threshold overrides".
const DEFAULT_THRESHOLD = 0.015

// `find` takes the FIRST match, so a specific entry sits above a broader one.
const THRESHOLD_OVERRIDES: { match: string; threshold: number }[] = [
  // Dense paired-end coverage strip; moves between rasterizers, so this is
  // antialiasing (accumulate-vs-resolve on a shallower pileup).
  { match: 'inversion-paired-coverage', threshold: 0.03 },
  // Abutting summary bars: Canvas2D antialiases each edge and leaves a lighter
  // seam where two meet on a fractional pixel; the GPU does not. Moves between
  // rasterizers. The span shape's `seamPx` would close it on Canvas2D.
  { match: 'maf-summary', threshold: 0.09 },
  // A 1 px step line crossing the pivot: Canvas2D cuts each crossing with a
  // capped stroke, the shader per fragment. Moves between rasterizers.
  { match: 'whiskers-band', threshold: 0.025 },
  // Accumulate-vs-resolve on SNP ticks and indicator triangles at arbitrary
  // sub-pixel x, ~40 deep per column: Canvas2D composites each and saturates,
  // the GPU resolves coverage once. Closing it means one merged mark per
  // column on Canvas2D. Covers `inversion-pbsim-linked` deliberately; the two
  // measure the same, so the connectors add nothing.
  { match: 'inversion-pbsim', threshold: 0.1 },
  // No per-base or synteny entry: CROSS_BACKEND_GATE.md §"The per-base wall"
  // and §"Synteny's drift is the sub-pixel fade" say why.
]

function thresholdFor(name: string) {
  const override = THRESHOLD_OVERRIDES.find(o => name.includes(o.match))
  return override ? override.threshold : DEFAULT_THRESHOLD
}

/**
 * A threshold as a percentage, without inventing precision or losing it: `0.015`
 * prints `1.5`, `0.03` prints `3`, `0.1` prints `10`.
 *
 * It was `.toFixed(0)`, which was exact while every threshold was a whole
 * percent and started rounding 1.5% to "2%" the moment the default was not — so
 * every line of the gate's own output would have misreported the number it had
 * just judged against.
 */
export function formatThresholdPct(threshold: number) {
  return String(Number((threshold * 100).toFixed(2)))
}

// Empty: scoping is `--ci-gate` / `--filter`.
const EXCLUDED_SUBSTRINGS: string[] = []

function isExcluded(name: string) {
  return EXCLUDED_SUBSTRINGS.some(s => name.includes(s))
}

// The suites the blocking CI job renders (`--ci-gate`). Exact names: the runner
// fails if one matches no suite, so a rename cannot silently shrink the gate.
// Local data only, and `--ci-gate` also forces remote off, so a push never
// depends on someone else's uptime. Adding a suite is a measurement: show it
// clean across consecutive `--drift-report` runs first.
export const CI_GATE_SUITES = [
  'Additional Track Types',
  'Alignments Color Schemes',
  'Alignments Track',
  'BasicLinearGenomeView',
  'BigWig Tracks',
  'Dotplot View',
  'GWAS Tracks',
  'HiC Track',
  'MAF Track',
  'Mark Display',
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
            ? `${(diff.diffFraction * 100).toFixed(2)}% drift (threshold ${formatThresholdPct(threshold)}%)`
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
