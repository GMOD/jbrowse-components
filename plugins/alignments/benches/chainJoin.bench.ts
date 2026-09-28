// What does joining chain identity on the main thread cost a region landing?
//
//   npx esbuild plugins/alignments/benches/chainJoin.bench.ts --bundle \
//     --platform=node --format=esm --outfile=/tmp/chainJoin.mjs
//   node --expose-gc /tmp/chainJoin.mjs --rounds=40
//
// Flags: --rounds=<n> (default 40), --reads=<n> total (default 200000),
// --regions=<n> (default 8), --warm (every region's per-region pass memoized,
// which leaves the cross-region part alone)
//
// THE QUESTION. The worker used to number chains per region and ship them; the
// main thread then re-joined them by name (`reconcileChainSuppAcrossRegions`)
// and, for the hover, joined them a second time (`buildReadIdsByChainName`).
// `attachChainFields` now does the numbering on the main thread, memoized per
// region, and settles every per-chain answer from one union. This replays a
// view's regions landing one at a time and sums the main-thread cost.
//
// THE ARMS, round-robin in one process, min across rounds:
//
//   before   per landing: the structured clone of the new region's
//            `chainNames` (typed arrays transfer; the string array copies),
//            then the reconcile over every region held.
//   after    per landing: `attachChainFields` over every region held, the
//            landed region cold and the others memoized.
//   control  `before` written out a second time on purpose.
//
// `readIds` is the hover's join, timed per arm once all regions have landed,
// since only a hover or a selection reads it. `mergeChains` (the layout's
// name join) is the same code in both, so neither arm counts it.
//
// WHAT IT SAYS. --rounds=40, min ms summed over the landings, on a laptop on AC
// with other agents' jobs running (load 13-16); controls 0.99-1.06x:
//
//                          before   after   chain layout, once
//   1 region,  100k reads    3.1     20.6      97
//   2 regions, 200k reads   37.9     69.3     199
//   8 regions, 200k reads  139.4    122.7     164
//
// So a view of one or two regions pays the per-region numbering the worker
// used to do, now on the main thread, and a view of many regions pays less
// than the reconcile did (ADR-188, measurement `chain-join-landings`). The first
// version of `attachChainFields` re-answered every read at every landing and
// allocated two objects per chain: 251 ms at 8 regions, 37 ms at one.

import { namesToBlock, readIdAt } from '@jbrowse/alignments-core'
import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import {
  attachChainFields,
  buildReadIdsByChainName,
} from '../src/LinearAlignmentsDisplay/chainFields.ts'
import { buildLaidOutChainMap } from '../src/LinearAlignmentsDisplay/computeChainLayout.ts'
import { baseWorkerPileupData } from '../src/RenderAlignmentDataRPC/testPileupData.ts'
import {
  CHAIN_FRAME_REV,
  CHAIN_SPLIT_MASK,
  CHAIN_SUPP_NONE,
  CHAIN_SUPP_PRESENT,
} from '../src/shared/types.ts'

import type {
  ChainPileupData,
  WorkerPileupData,
} from '../src/RenderAlignmentDataRPC/types.ts'

const arg = (name: string, dflt: number) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? Number(hit.split('=')[1]) : dflt
}
const ROUNDS = arg('rounds', 40)
const REGIONS = arg('regions', 8)
const PER_REGION = Math.floor(arg('reads', 200_000) / REGIONS / 2) * 2
const WARM = process.argv.includes('--warm')

// Pairs within a region, plus every 50th pair's read2 filed in the next region
// (a chain crossing a boundary) and every 70th read2 a supplementary.
function makeRegion(r: number): WorkerPileupData {
  const n = PER_REGION
  const names: string[] = []
  const flags = new Uint16Array(n)
  const strands = new Int8Array(n)
  const positions = new Uint32Array(n * 2)
  const orientations = new Uint8Array(n)
  const insertSizes = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const pair = i >> 1
    const second = i & 1
    const crossing = second && pair % 50 === 0 && r > 0
    names.push(crossing ? `r${r - 1}p${pair}` : `r${r}p${pair}`)
    flags[i] =
      SAM_FLAG_PAIRED |
      (second ? SAM_FLAG_SECOND_IN_PAIR : SAM_FLAG_FIRST_IN_PAIR) |
      (second && pair % 70 === 0 ? SAM_FLAG_SUPPLEMENTARY : 0)
    strands[i] = second ? -1 : 1
    const start = r * 1_000_000 + pair * 10
    positions[i * 2] = start + second * 200
    positions[i * 2 + 1] = start + second * 200 + 150
    orientations[i] = 1
    insertSizes[i] = 350
  }
  return {
    ...baseWorkerPileupData(n),
    ...namesToBlock(names),
    readKeys: Array.from({ length: n }, (_, i) => `r${r}k${i}`),
    readFlags: flags,
    readStrands: strands,
    readPositions: positions,
    readPairOrientations: orientations,
    readInsertSizes: insertSizes,
  }
}

const raw = Array.from({ length: REGIONS }, (_, r) => makeRegion(r))

// What the worker used to ship: one region's chains, numbered alone. Built with
// the new code over a one-region map, which is the same per-region pass.
const shipped: ChainPileupData[] = raw.map((data, idx) =>
  attachChainFields(new Map([['', new Map([[idx, data]])]]))
    .get('')!
    .get(idx)!,
)

// ---- the removed code, verbatim but for its imports ----

function chainSuppFill(hasSupp: boolean, primaryStrand: number) {
  return hasSupp
    ? CHAIN_SUPP_PRESENT | (primaryStrand === -1 ? CHAIN_FRAME_REV : 0)
    : CHAIN_SUPP_NONE
}

function reconcileBefore(map: Map<number, ChainPileupData>) {
  if (map.size < 2) {
    return map
  }
  const byChain = new Map<string, { hasSupp: boolean; primaryStrand: number }>()
  for (const data of map.values()) {
    const { readChainIndices, chainNames, readFlags, readStrands } = data
    for (let i = 0; i < readChainIndices.length; i++) {
      const name = chainNames[readChainIndices[i]!]!
      let entry = byChain.get(name)
      if (!entry) {
        entry = { hasSupp: false, primaryStrand: 0 }
        byChain.set(name, entry)
      }
      if (readFlags[i]! & SAM_FLAG_SUPPLEMENTARY) {
        entry.hasSupp = true
      } else {
        entry.primaryStrand = readStrands[i]!
      }
    }
  }
  const out = new Map<number, ChainPileupData>()
  for (const [idx, data] of map) {
    const { readChainIndices, chainNames, readChainHasSupp } = data
    let merged: Uint8Array | undefined
    for (let i = 0; i < readChainIndices.length; i++) {
      const own = readChainHasSupp[i]!
      const entry = byChain.get(chainNames[readChainIndices[i]!]!)!
      const fill =
        chainSuppFill(entry.hasSupp, entry.primaryStrand) |
        (own & CHAIN_SPLIT_MASK)
      if (fill !== own) {
        merged ??= new Uint8Array(readChainHasSupp)
        merged[i] = fill
      }
    }
    out.set(idx, merged ? { ...data, readChainHasSupp: merged } : data)
  }
  return out
}

function readIdsBefore(map: Map<number, ChainPileupData>) {
  const out = new Map<string, string[]>()
  for (const data of map.values()) {
    for (let i = 0; i < data.readKeys.length; i++) {
      const name = data.chainNames[data.readChainIndices[i]!]
      const id = readIdAt(data, i)
      if (name !== undefined && id !== undefined) {
        let ids = out.get(name)
        if (!ids) {
          ids = []
          out.set(name, ids)
        }
        ids.push(id)
      }
    }
  }
  return out
}

// ---- the arms, each written out longhand so no driver goes polymorphic ----

let sink = 0

function landBefore() {
  const held = new Map<number, ChainPileupData>()
  const t0 = performance.now()
  for (let idx = 0; idx < REGIONS; idx++) {
    sink += structuredClone(shipped[idx]!.chainNames).length
    held.set(idx, shipped[idx]!)
    sink += reconcileBefore(held).size
  }
  const t1 = performance.now()
  sink += readIdsBefore(reconcileBefore(held)).size
  return { land: t1 - t0, readIds: performance.now() - t1 }
}

function landControl() {
  const held = new Map<number, ChainPileupData>()
  const t0 = performance.now()
  for (let idx = 0; idx < REGIONS; idx++) {
    sink += structuredClone(shipped[idx]!.chainNames).length
    held.set(idx, shipped[idx]!)
    sink += reconcileBefore(held).size
  }
  const t1 = performance.now()
  sink += readIdsBefore(reconcileBefore(held)).size
  return { land: t1 - t0, readIds: performance.now() - t1 }
}

// A fresh `readKeys` identity per round, so each landed region is cold in the
// per-region memo exactly once, as it is when it lands.
function landAfter(round: WorkerPileupData[]) {
  const held = new Map<number, WorkerPileupData>()
  let attached = attachChainFields(new Map([['', held]]))
  const t0 = performance.now()
  for (let idx = 0; idx < REGIONS; idx++) {
    held.set(idx, round[idx]!)
    attached = attachChainFields(new Map([['', held]]))
    sink += attached.size
  }
  const t1 = performance.now()
  sink += buildReadIdsByChainName(attached).size
  return { land: t1 - t0, readIds: performance.now() - t1 }
}

// Identity: the union's has-supp and frame bits are what the reconcile
// computed. The split bits differ by design — the union classifies a mate
// against a primary in another region, which the reconcile left alone.
{
  const before = reconcileBefore(new Map(shipped.map((d, i) => [i, d])))
  const after = attachChainFields(
    new Map([['', new Map(raw.map((d, i) => [i, d]))]]),
  ).get('')!
  for (let idx = 0; idx < REGIONS; idx++) {
    const b = before.get(idx)!.readChainHasSupp
    const a = after.get(idx)!.readChainHasSupp
    for (let i = 0; i < b.length; i++) {
      if ((a[i]! & ~CHAIN_SPLIT_MASK) !== (b[i]! & ~CHAIN_SPLIT_MASK)) {
        throw new Error(
          `region ${idx} read ${i}: before ${b[i]} after ${a[i]} differ outside the split bits`,
        )
      }
    }
  }
}

const best = {
  before: { land: Infinity, readIds: Infinity },
  after: { land: Infinity, readIds: Infinity },
  control: { land: Infinity, readIds: Infinity },
}
const gc = (globalThis as { gc?: () => void }).gc
for (let round = 0; round < ROUNDS; round++) {
  const fresh = raw.map(d => ({
    ...d,
    readKeys: [...(d.readKeys as string[])],
  }))
  const order = [round % 3, (round + 1) % 3, (round + 2) % 3]
  for (const arm of order) {
    gc?.()
    const r =
      arm === 0
        ? landBefore()
        : arm === 1
          ? landAfter(WARM ? raw : fresh)
          : landControl()
    const slot = arm === 0 ? best.before : arm === 1 ? best.after : best.control
    slot.land = Math.min(slot.land, r.land)
    slot.readIds = Math.min(slot.readIds, r.readIds)
  }
}

// For scale: the chain layout over every region once all have landed, which
// both arms pay at each landing.
let layout = Infinity
const all = attachChainFields(
  new Map([['', new Map(raw.map((d, i) => [i, d]))]]),
).get('')!
for (let round = 0; round < 10; round++) {
  const t0 = performance.now()
  sink += buildLaidOutChainMap({ dataMap: all }).size
  layout = Math.min(layout, performance.now() - t0)
}

const fmt = (n: number) => n.toFixed(2).padStart(8)
console.log(
  `${REGIONS} regions x ${PER_REGION} reads, ${ROUNDS} rounds, min ms (sink ${sink % 7})`,
)
console.log('            landings   readIds')
for (const [name, r] of Object.entries(best)) {
  console.log(`${name.padEnd(10)}${fmt(r.land)}  ${fmt(r.readIds)}`)
}
console.log(`chain layout, all regions once: ${layout.toFixed(2)} ms`)
console.log(
  `after/before ${(best.after.land / best.before.land).toFixed(2)}x landings, ${(best.after.readIds / best.before.readIds).toFixed(2)}x readIds; control/before ${(best.control.land / best.before.land).toFixed(2)}x, ${(best.control.readIds / best.before.readIds).toFixed(2)}x`,
)
