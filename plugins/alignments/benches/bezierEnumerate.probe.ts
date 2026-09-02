// What would `crossRegion` scope cost if it enumerated a SINGLE-region section?
//
//   node --expose-gc plugins/alignments/benches/bezierEnumerate.probe.ts
//
// Flags: --reads=<n> (default 200000), --paired=<fraction> (default 0.1),
//        --rounds=<n> (default 15)
//
// `enumerateBezierPairs` short-circuits `crossRegion` on `map.size < 2`, and the
// dashed hidden-hop mark exists only in the overlay, so a same-region junction
// that skips an unfetched segment stays solid under that scope. Lifting the
// short-circuit is what would fix it; this prices the grouping that lift would
// newly pay on the view almost everyone has. Synthetic reads, ONE FIXTURE PER
// PROCESS — agent-docs/reference/BENCHMARKING.md.
//
// ARMS, interleaved:
//   all          — `enumerateBezierPairs(map, 'all')`, the grouping the lift
//                  would pay (every within-region normal pair is then dropped,
//                  so the result is empty and the cost is all enumeration)
//   crossRegion  — today's short-circuit
//   control      — a second copy of `all`
import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECOND_IN_PAIR,
} from '@jbrowse/cigar-utils'

import { makePileupDataResult } from '../src/RenderAlignmentDataRPC/testPileupData.ts'
import { iterLinkedPairs } from '../src/features/linkedReads/compute.ts'
import { PAIR_DIRECTION_NUM } from '../src/shared/buildBaseFeatureData.ts'
import { namesToBlock } from '../src/shared/readNameBlock.ts'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const READS = Number(arg('reads', '200000'))
const PAIRED = Number(arg('paired', '0.1'))
const ROUNDS = Number(arg('rounds', '15'))

function makeFixture(n: number, pairedFraction: number) {
  const names: string[] = []
  const flags: number[] = []
  const strands: number[] = []
  const positions: number[] = []
  const orientations: number[] = []
  let i = 0
  let fragment = 0
  while (i < n) {
    const paired = Math.random() < pairedFraction && i + 1 < n
    const start = 1_000_000 + fragment * 50
    if (paired) {
      const name = `frag${fragment}`
      names.push(name, name)
      flags.push(
        SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR,
        SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR,
      )
      strands.push(1, -1)
      positions.push(start, start + 150, start + 300, start + 450)
      orientations.push(PAIR_DIRECTION_NUM.LR, PAIR_DIRECTION_NUM.LR)
      i += 2
    } else {
      names.push(`read${fragment}`)
      flags.push(0)
      strands.push(1)
      positions.push(start, start + 150)
      orientations.push(0)
      i += 1
    }
    fragment++
  }
  const count = names.length
  return makePileupDataResult({
    ...namesToBlock(names),
    readKeys: names.map((_, k) => `id${k}`),
    readFlags: Uint16Array.from(flags),
    readStrands: Int8Array.from(strands),
    readPositions: Uint32Array.from(positions),
    readPairOrientations: Uint8Array.from(orientations),
    readYs: new Uint16Array(count),
    readInterchrom: new Uint8Array(count),
  })
}

const data = makeFixture(READS, PAIRED)
const map = new Map([[0, data]])

// `enumerateBezierPairs` itself is not imported: `computeOverlay.ts` reaches the
// sv-core barrel, which node's type stripper refuses at its first .tsx. This is
// the same walk with the `all` predicate written out.
function enumerateAll() {
  let kept = 0
  for (const { e1, e2, c } of iterLinkedPairs(map)) {
    if (!(c.isNormal && e1.displayedRegionIndex === e2.displayedRegionIndex)) {
      kept++
    }
  }
  return kept
}

const arms = {
  all: () => enumerateAll(),
  crossRegion: () => (map.size < 2 ? 0 : enumerateAll()),
  control: () => enumerateAll(),
}
type Arm = keyof typeof arms
const order = Object.keys(arms) as Arm[]
const best: Record<Arm, number> = {
  all: Infinity,
  crossRegion: Infinity,
  control: Infinity,
}

for (let r = 0; r < ROUNDS; r++) {
  for (const arm of order) {
    globalThis.gc?.()
    const t0 = performance.now()
    arms[arm]()
    const ms = performance.now() - t0
    best[arm] = Math.min(best[arm], ms)
  }
}

console.log(
  `${data.readKeys.length} reads, ${Math.round(PAIRED * 100)}% paired, single region`,
)
for (const arm of order) {
  console.log(`${arm.padEnd(12)} min ${best[arm].toFixed(1)}ms`)
}
