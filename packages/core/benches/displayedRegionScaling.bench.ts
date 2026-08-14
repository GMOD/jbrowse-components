// What does one `dynamicBlocks` recompute cost as an assembly gets more
// contigs, and what would a cumulative-offset index buy?
//
//   node packages/core/benches/displayedRegionScaling.bench.ts
//   node packages/core/benches/displayedRegionScaling.bench.ts --rounds=15
//
// `calculateDynamicBlocks` walks `displayedRegions` from index 0, accumulating
// `displayedRegionLeftPx`, and breaks once it is past the window's right edge.
// The break bounds the walk from the right and nothing bounds it from the left,
// so the cost is the number of regions BEFORE the viewport plus the number
// inside it. `dynamicBlocks` is a plain computed over `offsetPx`, which
// `useRafCommit` moves once per frame during a drag, so this runs per frame.
//
// hg38 with alts is 640 sequences and a draft assembly is routinely tens of
// thousands, which is the range this sweeps.
//
// WHAT IS MODELLED: the block walk itself, over `types.frozen<Region[]>()` —
// plain objects, which is what the LGV, the circular view and `Base1DViewModel`
// all store (`displayedRegions: types.frozen`). A `types.array(Region)` view
// would read every field through a MobX atom and cost several times this; none
// of the hot views does.
//
// WHAT IS NOT: everything downstream of the walk. Each of the ~57
// `dynamicBlocks` readers does its own work per block, and `staticBlocks` runs
// a second walk (with a memo fast path this one cannot have — see below). So a
// row here is a FLOOR on what a frame pays for the region count, not the total.
//
// The `indexed` arm is the remedy the register entry still proposes: a
// cumulative-bp prefix array, rebuilt only when `displayedRegions` changes,
// binary-searched for the first region whose right edge is inside the window.
// The array is built OUTSIDE the timed region on purpose — that is where it
// would live, as a computed on the view keyed by the regions array — and the
// bench reports its build cost separately so nobody has to take that on faith.
//
// The `prior` arm is the register's OTHER remedy, from the far side: the walk
// as it stood before the elided-run fast path landed in the baseline. Keeping
// it is what lets the fast path's ratio be re-measured interleaved and
// in-process rather than quoted from a table, which is the only kind of
// before/after this file's own rules trust.
//
// THE ARMS DISAGREE ABOVE ~10k REGIONS, and the identity check reports it
// rather than tolerating it, so the run needs `--allow-diff` to get past that
// row. The disagreement is the baseline's: summing one pixel width per region
// drifts, and at 10,000 contigs in a whole-genome view the accumulated left
// edge reaches 1000.0000000001588 px against an exact 1000, so the last
// region's `rightPx >= displayedRegionRightPx` misses by 1.6e-10 px, and the
// trailing `afterLastRegion` boundary block is not emitted. Dividing an exact
// cumulative bp has no such error. So the index is not only a speedup — it also
// stops a boundary block from disappearing on assemblies past a few thousand
// contigs, which is worth knowing before anyone diffs a snapshot after the
// swap and calls it a regression.
//
// No `staticBlocks` arm: it already carries a hand-rolled memo that skips the
// recompute when only `offsetPx` moved inside the covered range. `dynamicBlocks`
// cannot take that memo, because its answer is the viewport, so the index is the
// only lever left. That asymmetry is the whole reason this bench is about the
// dynamic one.
//
// Same four rules as the sibling benches — separate drivers per arm, a control
// arm that is the baseline declared twice, min of interleaved rounds, identity
// before timing. See `agent-docs/reference/BENCHMARKING.md`.
import { BlockSet } from '../src/util/blockTypes.ts'
import calculateDynamicBlocks from '../src/util/calculateDynamicBlocks.ts'
import { intersection2 } from '../src/util/range.ts'

import type { BaseBlock } from '../src/util/blockTypes.ts'
import type { Base1DViewModel } from '../src/util/calculateStaticBlocks.ts'

export {}

const rounds =
  Number(
    process.argv
      .find(a => a.startsWith('--rounds='))
      ?.slice('--rounds='.length),
  ) || 9

// Timing a pair of arms that emit different output is not a comparison, so a
// difference stops the run by default. See the header for the one that is
// known and deliberate.
const allowDiff = process.argv.includes('--allow-diff')

interface Region {
  assemblyName: string
  refName: string
  start: number
  end: number
  // optional, like core's Region — the arms hand `emitRegionBlock` elements off
  // the model, and a required boolean here makes that argument unassignable
  reversed?: boolean
}

const CONTIG_BP = 50_000

function makeRegions(n: number): Region[] {
  return Array.from({ length: n }, (_, i) => ({
    assemblyName: 'asm',
    refName: `scaffold_${i}`,
    start: 0,
    end: CONTIG_BP,
    reversed: false,
  }))
}

function makeModel(regions: Region[], bpPerPx: number, offsetPx: number) {
  return {
    offsetPx,
    displayedRegions: regions,
    bpPerPx,
    width: 1000,
    minimumBlockWidth: 3,
  }
}

// ---------------------------------------------------------------------------
// arm: control. `calculateDynamicBlocks` transcribed verbatim, so the ratio
// against the imported one shows what this harness can resolve. The duplication
// is deliberate: an arm that calls the same function the baseline calls shares
// its inline caches and measures nothing.
// ---------------------------------------------------------------------------
function controlBlocks(model: Base1DViewModel) {
  const { offsetPx, displayedRegions, bpPerPx, width, minimumBlockWidth } =
    model
  const invBpPerPx = 1 / bpPerPx
  const blocks = new BlockSet()
  let displayedRegionLeftPx = 0
  const windowLeftPx = offsetPx
  const windowRightPx = windowLeftPx + width
  const last = displayedRegions.length - 1
  for (let idx = 0; idx < displayedRegions.length; idx++) {
    if (displayedRegionLeftPx > windowRightPx) {
      break
    }
    const r = displayedRegions[idx]!
    const regionWidthPx = (r.end - r.start) * invBpPerPx
    // Inline rather than a shared helper both local arms call. A call per
    // region is real work the imported baseline does not do, and factoring it
    // out put this control at 1.5x on the zoomed rows — which by the rule in
    // BENCHMARKING.md means those rows measured nothing. The duplication below
    // is the fix, and is deliberate.
    const displayedRegionRightPx = displayedRegionLeftPx + regionWidthPx
    const [leftPx, rightPx] = intersection2(
      windowLeftPx,
      windowRightPx,
      displayedRegionLeftPx,
      displayedRegionRightPx,
    )
    if (leftPx !== undefined && rightPx !== undefined) {
      const leftBp = (leftPx - displayedRegionLeftPx) * bpPerPx
      const rightBp = (rightPx - displayedRegionLeftPx) * bpPerPx
      const start = r.reversed
        ? Math.max(r.start, r.end - rightBp)
        : r.start + leftBp
      const end = r.reversed
        ? r.end - leftBp
        : Math.min(r.end, r.start + rightBp)
      const widthPx = (end - start) * invBpPerPx
      const merged =
        regionWidthPx < minimumBlockWidth &&
        idx !== last &&
        blocks.growElidedRun(widthPx)
      if (!merged) {
        emitRegionBlock(
          blocks,
          r,
          idx,
          displayedRegionLeftPx,
          displayedRegionRightPx,
          regionWidthPx,
          leftPx,
          rightPx,
          start,
          end,
          widthPx,
          offsetPx,
          width,
          minimumBlockWidth,
          displayedRegions.length,
        )
      }
    }
    displayedRegionLeftPx += regionWidthPx
  }
  return blocks
}

// ---------------------------------------------------------------------------
// arm: indexed. The same walk the baseline does, elided-run fast path and all,
// entered at the first region the window can touch instead of at index 0. It
// carries the fast path so the column answers what the index would buy ON TOP
// of what the function already does, rather than against a version of it that
// no longer exists.
// ---------------------------------------------------------------------------

/**
 * Cumulative bp before each region, plus the total — what a view would hold as
 * a computed over `displayedRegions`. bp rather than px so it survives a zoom,
 * and float64 rather than Float64Array only because the sizes here are exact
 * either way; a real one should be a Float64Array of length n+1.
 */
function buildCumulativeBp(regions: Region[]) {
  const cum = new Float64Array(regions.length + 1)
  let acc = 0
  for (let i = 0; i < regions.length; i++) {
    cum[i] = acc
    acc += regions[i]!.end - regions[i]!.start
  }
  cum[regions.length] = acc
  return cum
}

/** First index whose right edge is strictly past `bp`, or regions.length. */
function firstRegionAfter(cum: Float64Array, bp: number) {
  let lo = 0
  let hi = cum.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cum[mid + 1]! <= bp) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

function indexedBlocks(model: Base1DViewModel, cum: Float64Array) {
  const { offsetPx, displayedRegions, bpPerPx, width, minimumBlockWidth } =
    model
  const invBpPerPx = 1 / bpPerPx
  const blocks = new BlockSet()
  const windowLeftPx = offsetPx
  const windowRightPx = windowLeftPx + width
  const last = displayedRegions.length - 1
  const first = firstRegionAfter(cum, Math.max(0, windowLeftPx) * bpPerPx)
  for (let idx = first; idx < displayedRegions.length; idx++) {
    const displayedRegionLeftPx = cum[idx]! * invBpPerPx
    if (displayedRegionLeftPx > windowRightPx) {
      break
    }
    const r = displayedRegions[idx]!
    const regionWidthPx = (r.end - r.start) * invBpPerPx
    const displayedRegionRightPx = displayedRegionLeftPx + regionWidthPx
    const [leftPx, rightPx] = intersection2(
      windowLeftPx,
      windowRightPx,
      displayedRegionLeftPx,
      displayedRegionRightPx,
    )
    if (leftPx !== undefined && rightPx !== undefined) {
      const leftBp = (leftPx - displayedRegionLeftPx) * bpPerPx
      const rightBp = (rightPx - displayedRegionLeftPx) * bpPerPx
      const start = r.reversed
        ? Math.max(r.start, r.end - rightBp)
        : r.start + leftBp
      const end = r.reversed
        ? r.end - leftBp
        : Math.min(r.end, r.start + rightBp)
      const widthPx = (end - start) * invBpPerPx
      if (
        !(
          regionWidthPx < minimumBlockWidth &&
          idx !== last &&
          blocks.growElidedRun(widthPx)
        )
      ) {
        emitRegionBlock(
          blocks,
          r,
          idx,
          displayedRegionLeftPx,
          displayedRegionRightPx,
          regionWidthPx,
          leftPx,
          rightPx,
          start,
          end,
          widthPx,
          offsetPx,
          width,
          minimumBlockWidth,
          displayedRegions.length,
        )
      }
    }
  }
  return blocks
}

// The build half — the key and the block objects — called only for a region
// that gets one. Every arm shares it because it is not what they differ in:
// what is being compared is how the loop REACHES a region and whether it
// bothers to build a block for it, and every arm that does build one builds the
// same thing. The intersection test and the clipped start/end stay inlined in
// each loop, because those run per region rather than per built block, and a
// call there is what made the control unreadable.
function emitRegionBlock(
  blocks: BlockSet,
  r: Region,
  displayedRegionIndex: number,
  displayedRegionLeftPx: number,
  displayedRegionRightPx: number,
  regionWidthPx: number,
  leftPx: number,
  rightPx: number,
  start: number,
  end: number,
  widthPx: number,
  offsetPx: number,
  width: number,
  minimumBlockWidth: number,
  regionCount: number,
) {
  const { assemblyName, refName, reversed } = r
  const isLeftEndOfDisplayedRegion = leftPx <= displayedRegionLeftPx
  const isRightEndOfDisplayedRegion = rightPx >= displayedRegionRightPx
  const blockOffsetPx = leftPx
  const key = `${assemblyName}:${refName}:${start}:${end}:${displayedRegionIndex}${reversed ? ':rev' : ''}`

  if (displayedRegionIndex === 0 && isLeftEndOfDisplayedRegion) {
    blocks.push({
      type: 'InterRegionPaddingBlock',
      key: `${key}-beforeFirstRegion`,
      widthPx: -offsetPx,
      offsetPx: blockOffsetPx + offsetPx,
      variant: 'boundary',
    })
  }
  const data = {
    assemblyName,
    refName,
    start,
    end,
    reversed,
    offsetPx: blockOffsetPx,
    displayedRegionIndex,
    widthPx,
    isLeftEndOfDisplayedRegion,
    isRightEndOfDisplayedRegion,
    key,
  }
  blocks.push(
    regionWidthPx < minimumBlockWidth
      ? { ...data, type: 'ElidedBlock' }
      : { ...data, type: 'ContentBlock' },
  )
  if (displayedRegionIndex === regionCount - 1 && isRightEndOfDisplayedRegion) {
    const afterOffsetPx = blockOffsetPx + widthPx
    blocks.push({
      type: 'InterRegionPaddingBlock',
      key: `${key}-afterLastRegion`,
      widthPx: width - afterOffsetPx + offsetPx,
      offsetPx: afterOffsetPx,
      variant: 'boundary',
    })
  }
}

// ---------------------------------------------------------------------------
// arm: prior. The walk as it stood before the elided-run fast path, kept as an
// arm rather than left to git because that is the only honest way to state what
// the fast path bought: by BENCHMARKING.md's own rule, a before/after taken
// from two runs on a shared box measures the box as much as the change, and
// only an interleaved in-process arm does not.
//
// What it does that the baseline no longer does: at whole-genome zoom nearly
// every region is narrower than `minimumBlockWidth`, becomes an ElidedBlock,
// and `BlockSet.push` merges it straight into its predecessor keeping only the
// FIRST sub-block's key and identity — so the template-literal key and the two
// object literals were built and thrown away for every region in an elided run
// but its first.
// ---------------------------------------------------------------------------
function priorBlocks(model: Base1DViewModel) {
  const { offsetPx, displayedRegions, bpPerPx, width, minimumBlockWidth } =
    model
  const invBpPerPx = 1 / bpPerPx
  const blocks = new BlockSet()
  let displayedRegionLeftPx = 0
  const windowLeftPx = offsetPx
  const windowRightPx = windowLeftPx + width
  for (let idx = 0; idx < displayedRegions.length; idx++) {
    if (displayedRegionLeftPx > windowRightPx) {
      break
    }
    const r = displayedRegions[idx]!
    const regionWidthPx = (r.end - r.start) * invBpPerPx
    const displayedRegionRightPx = displayedRegionLeftPx + regionWidthPx
    const [leftPx, rightPx] = intersection2(
      windowLeftPx,
      windowRightPx,
      displayedRegionLeftPx,
      displayedRegionRightPx,
    )
    if (leftPx !== undefined && rightPx !== undefined) {
      const leftBp = (leftPx - displayedRegionLeftPx) * bpPerPx
      const rightBp = (rightPx - displayedRegionLeftPx) * bpPerPx
      const start = r.reversed
        ? Math.max(r.start, r.end - rightBp)
        : r.start + leftBp
      const end = r.reversed
        ? r.end - leftBp
        : Math.min(r.end, r.start + rightBp)
      emitRegionBlock(
        blocks,
        r,
        idx,
        displayedRegionLeftPx,
        displayedRegionRightPx,
        regionWidthPx,
        leftPx,
        rightPx,
        start,
        end,
        (end - start) * invBpPerPx,
        offsetPx,
        width,
        minimumBlockWidth,
        displayedRegions.length,
      )
    }
    displayedRegionLeftPx += regionWidthPx
  }
  return blocks
}

// --- drivers, written out longhand so no call site goes polymorphic ---------

function timeCurrent(model: Base1DViewModel, reps: number) {
  const t = performance.now()
  for (let i = 0; i < reps; i++) {
    calculateDynamicBlocks(model)
  }
  return (performance.now() - t) / reps
}

function timeControl(model: Base1DViewModel, reps: number) {
  const t = performance.now()
  for (let i = 0; i < reps; i++) {
    controlBlocks(model)
  }
  return (performance.now() - t) / reps
}

function timeIndexed(model: Base1DViewModel, cum: Float64Array, reps: number) {
  const t = performance.now()
  for (let i = 0; i < reps; i++) {
    indexedBlocks(model, cum)
  }
  return (performance.now() - t) / reps
}

function timePrior(model: Base1DViewModel, reps: number) {
  const t = performance.now()
  for (let i = 0; i < reps; i++) {
    priorBlocks(model)
  }
  return (performance.now() - t) / reps
}

function timeBuildIndex(regions: Region[], reps: number) {
  const t = performance.now()
  for (let i = 0; i < reps; i++) {
    buildCumulativeBp(regions)
  }
  return (performance.now() - t) / reps
}

// --- identity, before any timing is believed --------------------------------

// The two arms accumulate the left edge differently — the baseline sums
// per-region pixel widths, the indexed one divides an exact cumulative bp — so
// they agree to float64 rounding rather than bit-for-bit. The tolerance is a
// millionth of a pixel; a real disagreement is regions wide.
const EPS = 1e-6

function describe(b: BaseBlock) {
  return `${b.type} ${b.key} off=${b.offsetPx} w=${b.widthPx}`
}

function report(message: string) {
  if (allowDiff) {
    console.log(`  DIFF (allowed): ${message}`)
  } else {
    throw new Error(`${message}\n\nRe-run with --allow-diff to time it anyway.`)
  }
}

function checkIdentity(
  model: Base1DViewModel,
  cum: Float64Array,
  label: string,
) {
  const a = calculateDynamicBlocks(model).blocks
  const b = controlBlocks(model).blocks
  const c = indexedBlocks(model, cum).blocks
  const d = priorBlocks(model).blocks
  for (const [name, other] of [
    ['control', b],
    ['indexed', c],
    ['prior', d],
  ] as const) {
    const n = Math.min(a.length, other.length)
    for (let i = 0; i < n; i++) {
      const x = a[i]!
      const y = other[i]!
      if (
        x.type !== y.type ||
        x.key !== y.key ||
        Math.abs(x.offsetPx - y.offsetPx) > EPS ||
        Math.abs(x.widthPx - y.widthPx) > EPS
      ) {
        report(
          `${label}: ${name} differs at block ${i}\n    baseline ${describe(x)}\n    ${name} ${describe(y)}`,
        )
        return
      }
    }
    if (other.length !== a.length) {
      // the shared prefix matched, so the whole difference is in the tail —
      // name the blocks one side has and the other doesn't
      const [longer, shorter] =
        other.length > a.length ? ([other, a] as const) : ([a, other] as const)
      const extraOwner = other.length > a.length ? name : 'baseline'
      report(
        `${label}: ${extraOwner} emitted ${longer.length} blocks against ${shorter.length}; ` +
          `extra: ${longer
            .slice(shorter.length)
            .map(x => describe(x))
            .join(', ')}`,
      )
    }
  }
}

// --- run --------------------------------------------------------------------

const SIZES = [25, 640, 2500, 10_000, 50_000, 200_000]

// Two viewports, because they exercise the two halves of the walk. `whole
// genome` is what the Show-all-regions button does: every region is inside the
// window, so the break never fires. `zoomed, last contig` is the case that
// looks like it should be cheap — a 100 kb window on the final scaffold — and
// pays for every region in front of it.
for (const [label, viewport] of [
  ['whole genome', 'all'],
  ['zoomed, last contig', 'end'],
] as const) {
  console.log(
    `\n${label}\n${'regions'.padStart(8)}  ${'current'.padStart(9)}  ${'indexed'.padStart(9)}  ` +
      `${'idx x'.padStart(7)}  ${'prior'.padStart(9)}  ${'prior x'.padStart(7)}  ` +
      `${'control'.padStart(7)}  ${'build idx'.padStart(9)}`,
  )
  for (const n of SIZES) {
    const regions = makeRegions(n)
    const cum = buildCumulativeBp(regions)
    const totalBp = n * CONTIG_BP
    const model =
      viewport === 'all'
        ? makeModel(regions, totalBp / 1000, 0)
        : makeModel(regions, 100, totalBp / 100 - 1000)
    checkIdentity(model, cum, `${label} n=${n}`)

    const reps = n > 100_000 ? 5 : 25
    for (let r = 0; r < 5; r++) {
      timeCurrent(model, 1)
      timeIndexed(model, cum, 1)
      timePrior(model, 1)
      timeControl(model, 1)
    }
    let cur = Infinity
    let idx = Infinity
    let prior = Infinity
    let ctl = Infinity
    let bld = Infinity
    for (let round = 0; round < rounds; round++) {
      cur = Math.min(cur, timeCurrent(model, reps))
      idx = Math.min(idx, timeIndexed(model, cum, reps))
      prior = Math.min(prior, timePrior(model, reps))
      ctl = Math.min(ctl, timeControl(model, reps))
      bld = Math.min(bld, timeBuildIndex(regions, 3))
    }
    console.log(
      `${n.toLocaleString().padStart(8)}  ${cur.toFixed(3).padStart(9)}  ${idx.toFixed(3).padStart(9)}  ` +
        `${(cur / idx).toFixed(1).padStart(7)}  ${prior.toFixed(3).padStart(9)}  ` +
        `${(prior / cur).toFixed(1).padStart(7)}  ${(ctl / cur).toFixed(2).padStart(7)}  ` +
        bld.toFixed(3).padStart(9),
    )
  }
}

console.log(
  '\nms per call, min of interleaved rounds. `idx x` is current/indexed — what\n' +
    'the unlanded prefix index would still buy. `prior x` is prior/current —\n' +
    'what the landed elided-run fast path already bought. The two answer\n' +
    'different viewports and neither subsumes the other: the index skips\n' +
    'regions the window never touches, so it does nothing at whole-genome zoom\n' +
    'where every region is touched, and the fast path skips work per touched\n' +
    'region, so it does nothing when few are. `control` is the baseline\n' +
    'transcribed a second time — far from 1.00 means the row measured nothing.\n' +
    '`build idx` is one rebuild of the prefix array, which happens per\n' +
    'displayedRegions change, not per frame; compare it against `current`\n' +
    'times the frames in a drag, not against one call.',
)
