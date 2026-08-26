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

// Where the gate is told not to look. The default is 1.5% (below); a name listed
// here raises its own ceiling. Keyed by substring of the snapshot name (the
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
// **Run the second pass with `--real-gpu`, not by omitting `--swiftshader`.**
// Headless Chrome does not select a GPU on its own, so "render it again without
// the flag" is SwiftShader against SwiftShader and every pair then agrees to two
// decimals for a reason that has nothing to do with rendering — which makes the
// rule above fire on everything. Measured with `probe-renderer.ts`, 2026-08-11;
// `--drift-report` prints every pair, which is what the audit reads.
//
// So: an entry needs a measured number and a reason that survives the rasterizer
// test. Re-run the audit after any change to a shared draw path.
//
// **3% -> 1.5%, 2026-08-11.** The default is set by the antialiasing floor, and
// the floor was measured rather than assumed: across the CI gate's 66 pairs the
// worst is 0.62%, the median 0.00%, and exactly one pair exceeds 0.5% — with the
// figures byte-identical between two consecutive runs. 1.5% is ~2.4x that worst
// case. It is deliberately not 1%: this gate was once switched off for being
// noisy, and margin is worth more than tightness on a blocking job.
//
// Tightening a GLOBAL default is pinned by the widest scope, not by CI's, since
// `pnpm test:browser:gate` runs every local suite. Measured there too — 157
// pairs, median 0.02% — which is where the four entries below come from. Three
// of the five pairs over 1% turned out to be the SAME bug (see
// `-linked` below); that is the tightening paying for itself before it lands.
const DEFAULT_THRESHOLD = 0.015

// **Order matters: `find` takes the FIRST match**, so a specific entry must sit
// above the broader one it would otherwise be swallowed by. Latent while there
// was only one entry.
const THRESHOLD_OVERRIDES: { match: string; threshold: number }[] = [
  // `alignments-long-reads-sv-linked` had an entry here at 2.5%, for a read
  // outline that Canvas2D straddled on the rect boundary while the shader
  // repainted an inner band. Both draw the inner band now (READ_OUTLINE_* in
  // read.slang, `strokeRectInside` on the canvas side) and the pair measures
  // **0.75%**, under the default — so the entry is gone rather than lowered,
  // which is what an override reaching zero is supposed to look like.
  //
  // The 0.75% left still does not move between rasterizers, and is the same
  // concept one level down: the chevron arrowhead's outline is a centred stroke
  // on a polygon here and a distance-to-the-two-diagonals test on the GPU. Filed
  // in agent-docs/TODO.md; it is under the default, so it is a note and not an
  // exemption.
  // Dense paired-end coverage strip, measured 2.40% under swiftshader and 2.31%
  // on a real GPU. It MOVES, so unlike the two above this really is
  // rasterization — the first entry in this list whose antialiasing claim the
  // audit has actually confirmed rather than refuted. Same
  // accumulate-vs-resolve asymmetry the inversion-pbsim entry describes, on a
  // shallower pileup.
  //
  // It was deleted on 2026-08-05 at "measured 2.22%" because it sat under the
  // old 3% default; it is 2.40% now, which is worth watching on its own.
  { match: 'inversion-paired-coverage', threshold: 0.03 },
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
  // 10%, above the measured 6.59% — now 7.59% under swiftshader and 7.41% on a
  // real GPU, so it still moves and is still the rasterizer plus that residue.
  // This number should keep falling; it is a record of what is still broken, not
  // a setting.
  //
  // Covers `inversion-pbsim-linked` too, and deliberately: the two measure the
  // SAME 3.94%, which is the evidence that the bezier connectors those views add
  // contribute essentially nothing and the drift is the shared pileup rendering.
  // An earlier revision split `-linked` out as its own entry on the theory that
  // it was a separate connector bug; the equal figures refuted that before it
  // landed.
  { match: 'inversion-pbsim', threshold: 0.1 },
  // NO SYNTENY ENTRY, and there was one — `hs1-mm39-synteny-clean-ribbon` at 2%,
  // the only synteny pair that ever drifted and the only curve-mode entry this
  // list has held. It sat at 1.58% against the 1.5% default and is now 0.64%
  // (measured, this gate, both backends under swiftshader), so there is nothing
  // left for a special case to accommodate.
  //
  // What it was accommodating was `ribbonPerpWidth` deciding fill-vs-stroke as
  // well as the sub-pixel alpha: a curved ribbon wide at both ends and pinched in
  // the middle measured under a pixel by the chord and came out a 1px hairline on
  // Canvas2D against a filled band on the GPU. `ribbonMaxPerpWidth` split that
  // decision off. The residual is the alpha half — real, understood, and parked
  // with its numbers in agent-docs/TODO.md — and it no longer needs its own line
  // here. Don't re-add one without a gate run saying which pair wants it.
  //
  // Nor a zoomed synteny entry, which is the obvious response to "the bug lived
  // in a regime no entry covers" and measures false: `--loc=chr1,` on the probe
  // reads 0.02% with the fix and 0.02% without it. This is a fraction-of-pixels
  // oracle, so its sensitivity tracks ribbon COUNT rather than how wrong any one
  // ribbon is — a zoomed view holds a handful of blocks and a handful drawn
  // wrong rounds to nothing, which is why the whole-genome pair was the one that
  // caught this.
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
//
// The two alignments suites joined on the same evidence — three consecutive
// clean runs, tight drift — and for a while they held only because CI ran
// `--skip-webgpu`: under webgpu they went eight pairs over threshold. That was
// the capture scrolling the canvas under the app header, not the render, and
// `captureElementPng` fixed it on 2026-08-26 — the same 40 pairs now measure 0
// over threshold, max 0.91%. `pnpm test:browser:gate` renders webgpu because of
// that; `:gate:ci` still does not, because the CI runner has no Firefox Nightly
// and no display. agent-docs/reference/CROSS_BACKEND_GATE.md, "Alignments under
// webgpu".
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
