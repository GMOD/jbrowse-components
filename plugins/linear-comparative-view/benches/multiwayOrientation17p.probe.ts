/* eslint-disable no-console */
// Does each lane's [rev] at the 17p figure agree with the raw alignments?
//
//   pnpm exec esbuild --bundle --platform=node --format=esm --target=node22 \
//     --outfile=/tmp/orient17p.mjs \
//     plugins/linear-comparative-view/benches/multiwayOrientation17p.probe.ts
//   node /tmp/orient17p.mjs
//
// THE RECORD, which this rewrites: agent-docs/measurements/multiway-17p-orientation.json.
//
// THE QUESTION. `multiway_synteny/hg38_vertebrates_17p_break` draws eight
// liftOver lanes under hg38 chr17:15,200,014-16,400,014 and marks five of
// them [rev]. The mark comes out of `decideLaneFrames` — the orientation vote
// against the lane above, or the anchor-order fallback where the vote
// abstains — and this reads the same window through the same adapter with the
// display's own fetch options, runs the same decision with no incumbent (a
// fresh load, which is what the figure is), and puts beside each lane's answer
// what the raw rows say: the aligned bp on each strand of the contig the lane
// draws, after the 10 kb gap split and the clip to the window. A lane whose
// strands are near even is one where the vote's choice is arbitrary and the
// hysteresis, not the data, decides.
import fs from 'node:fs'
import path from 'node:path'

import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom, toArray } from 'rxjs'

import MultiPairwiseSyntenyAdapterF from '../../comparative-adapters/src/MultiPairwiseSyntenyAdapter/index.ts'
import PairwiseIndexedPAFAdapterF from '../../comparative-adapters/src/PairwiseIndexedPAFAdapter/index.ts'
import { SPLIT_AT_GAP_BP } from '../src/MultiWaySyntenyDisplay/afterAttach.ts'
import {
  computeRowFrame,
  decideLaneFrames,
  frameFromDecision,
} from '../src/MultiWaySyntenyDisplay/laneDecision.ts'
import {
  groupFeatures,
  groupRunsOnRow,
  rowAssembliesOf,
  rowFrameX,
} from '../src/MultiWaySyntenyDisplay/layoutMultiWay.ts'

import type { RowFrame } from '../src/MultiWaySyntenyDisplay/layoutMultiWay.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

class PifOnly extends Plugin {
  name = 'PifOnly'
  install(pluginManager: PluginManager) {
    MultiPairwiseSyntenyAdapterF(pluginManager)
    PairwiseIndexedPAFAdapterF(pluginManager)
  }
}

const pluginManager = new PluginManager([new PifOnly()])
pluginManager.createPluggableElements()
pluginManager.configure()

// Verbatim from demos/hg38_vertebrates' `hg38_liftover_multiway` track.
const MATES = [
  'panTro6',
  'gorGor6',
  'ponAbe3',
  'rheMac10',
  'calJac4',
  'mm39',
  'canFam6',
  'bosTau9',
]
const adapterConfig = {
  type: 'MultiPairwiseSyntenyAdapter',
  adapters: MATES.map(mate => ({
    type: 'PairwiseIndexedPAFAdapter',
    uri: `https://jbrowse.org/ucsc/hg38/liftOver/hg38To${mate[0]!.toUpperCase()}${mate.slice(1)}.over.pif.gz`,
    csi: true,
    assemblyNames: [mate, 'hg38'],
  })),
}

const ANCHOR = 'hg38'
const REF = 'chr17'
const START = 15_200_014
const END = 16_400_014
const WINDOW_BP = END - START
// the figure's viewport is 1500 px wide
const WIDTH = 1500

const { dataAdapter } = await getAdapter(
  pluginManager,
  'multiway-orientation-17p-probe',
  adapterConfig,
)
// the display's fetch is `CoreGetFeatures`: `getFeaturesInMultipleRegions`,
// which is where the clip and the split are honoured, serialised across the
// RPC and rebuilt as SimpleFeature — a live SyntenyFeature answers `name` with
// its mate's contig, which would key every record on one contig into one group
const features = (
  await firstValueFrom(
    (dataAdapter as BaseFeatureDataAdapter)
      .getFeaturesInMultipleRegions(
        [{ refName: REF, start: START, end: END, assemblyName: ANCHOR }],
        {
          clipToRegion: true,
          splitAtGapBp: SPLIT_AT_GAP_BP,
          mateShape: 'grouped',
        },
      )
      .pipe(toArray()),
  )
).map(f => new SimpleFeature(f.toJSON()))
const groups = groupFeatures(features)
const lanes = rowAssembliesOf(groups, [], (a, b) => a === b).filter(
  a => a !== ANCHOR,
)
console.log(
  `${features.length} records, ${groups.length} groups, ${lanes.length} lanes`,
)

const pxOf = (coord: number) => ((coord - START) / WINDOW_BP) * WIDTH
const anchorX = new Map(
  groups.map(g => [g.key, pxOf((g.anchor.start + g.anchor.end) / 2)]),
)
const decisions = decideLaneFrames({
  groups,
  assemblyNames: lanes,
  anchorX,
  anchorCoordOf: g => ({
    refName: g.anchor.refName,
    coord: (g.anchor.start + g.anchor.end) / 2,
  }),
  pxOfAnchor: c => pxOf(c.coord),
  unitBp: WINDOW_BP,
  width: WIDTH,
  previous: new Map(),
})

interface Placement {
  key: string
  center: number
  weight: number
  groupWeight: number
}

function placementsIn(assemblyName: string, frame: RowFrame): Placement[] {
  return groups.flatMap(group =>
    groupRunsOnRow(group, assemblyName, frame).map(run => ({
      key: group.key,
      center: (run.min + run.max) / 2,
      weight: Math.max(run.max - run.min, 1),
      groupWeight: group.weight,
    })),
  )
}

// `orientationVote`'s two rules, over the placements the vote sees: every
// pair weighed by the product of the groups' evidence (what ships), and each
// run against its neighbour weighed by the lighter run (what shipped before
// 2026-09-06). Both read backwards where the lane's order runs against the
// lane above's
function voteShares(upperX: Map<string, number>, lane: Placement[]) {
  const shared = lane
    .filter(p => upperX.has(p.key))
    .sort((a, b) => upperX.get(a.key)! - upperX.get(b.key)!)
  let pairsBackwards = 0
  let pairsTotal = 0
  for (let i = 0; i < shared.length; i++) {
    for (let j = i + 1; j < shared.length; j++) {
      const a = shared[i]!
      const b = shared[j]!
      if (a.key !== b.key) {
        const w = a.groupWeight * b.groupWeight
        pairsTotal += w
        pairsBackwards += b.center < a.center ? w : 0
      }
    }
  }
  let nextBackwards = 0
  let nextTotal = 0
  for (let i = 1; i < shared.length; i++) {
    const a = shared[i - 1]!
    const b = shared[i]!
    if (a.key !== b.key) {
      const w = Math.min(a.weight, b.weight)
      nextTotal += w
      nextBackwards += b.center < a.center ? w : 0
    }
  }
  return {
    shared: new Set(shared.map(p => p.key)).size,
    allPairs: pairsTotal > 0 ? pairsBackwards / pairsTotal : undefined,
    neighbour: nextTotal > 0 ? nextBackwards / nextTotal : undefined,
  }
}

function strandBp(assemblyName: string, refName: string) {
  const bp = { forward: 0, reverse: 0 }
  for (const group of groups) {
    for (const p of group.mates.get(assemblyName) ?? []) {
      if (p.refName === refName) {
        const anchorBp = group.anchor.end - group.anchor.start
        if (p.orientation < 0) {
          bp.reverse += anchorBp
        } else {
          bp.forward += anchorBp
        }
      }
    }
  }
  return bp
}

const share = (n: number | undefined) =>
  n === undefined ? 'abstains' : n.toFixed(3)

console.log(
  '\nlane        contig   drawn  fallback  shared  all-pairs bwd  neighbour bwd     + bp       - bp   majority',
)
const rows: Record<string, string | number>[] = []
let upperX = anchorX
for (const [i, assemblyName] of lanes.entries()) {
  const decision = decisions.get(assemblyName)
  if (!decision) {
    console.log(`${assemblyName.padEnd(11)} places nothing`)
    continue
  }
  const frame = frameFromDecision(
    decision,
    pxOf(decision.pivotAnchor.coord),
    WINDOW_BP,
    WIDTH,
  )
  const placements = placementsIn(assemblyName, frame)
  const votes = voteShares(upperX, placements)
  const fallback = computeRowFrame(groups, assemblyName, WINDOW_BP)?.flipped
  const bp = strandBp(assemblyName, decision.refName)
  const total = bp.forward + bp.reverse
  const majority = bp.reverse > bp.forward ? '-' : '+'
  const majorityShare = total > 0 ? Math.max(bp.forward, bp.reverse) / total : 0
  const values: Record<string, string | number> = {
    lane: assemblyName,
    contig: decision.refName,
    drawn: decision.flipped ? '[rev]' : 'forward',
    fallback: fallback ? '[rev]' : 'forward',
    shared: votes.shared,
    allPairsBackwards: share(votes.allPairs),
    neighbourBackwards: share(votes.neighbour),
    forwardBp: bp.forward,
    reverseBp: bp.reverse,
    majority: `${majority} ${majorityShare.toFixed(3)}`,
  }
  rows.push(values)
  console.log(
    [
      assemblyName.padEnd(11),
      decision.refName.padEnd(8),
      String(values.drawn).padEnd(8),
      String(values.fallback).padEnd(9),
      String(votes.shared).padStart(5),
      String(values.allPairsBackwards).padStart(14),
      String(values.neighbourBackwards).padStart(14),
      String(bp.forward).padStart(10),
      String(bp.reverse).padStart(10),
      `  ${values.majority}`,
    ].join(' '),
  )
  if (i + 1 < lanes.length) {
    const heaviest = new Map<string, Placement>()
    for (const p of placements) {
      const held = heaviest.get(p.key)
      if (!held || p.weight > held.weight) {
        heaviest.set(p.key, p)
      }
    }
    upperX = new Map(
      [...heaviest.values()].map(p => [
        p.key,
        rowFrameX(frame, p.center, WIDTH),
      ]),
    )
  }
}

const record = path.resolve(
  'agent-docs/measurements/multiway-17p-orientation.json',
)
const existing = JSON.parse(fs.readFileSync(record, 'utf8')) as {
  rows: { values: Record<string, string | number> }[]
}
existing.rows = rows.map(values => ({ values }))
fs.writeFileSync(record, `${JSON.stringify(existing, null, 2)}\n`)
console.log(`\nwrote ${path.relative(process.cwd(), record)}`)
console.log(
  '\ndrawn: the [rev] the figure shows, from `decideLaneFrames` with no incumbent.\n' +
    "fallback: `computeRowFrame`'s anchor-order sign sum, which decides only where\n" +
    'the vote abstains. shared: groups the lane shares with the lane above, which\n' +
    'on a pairwise source is every group for the top lane and none below it. The\n' +
    "bp columns are anchor bp of the lane's placements on the drawn contig by the\n" +
    'record strand, after the clip and the 10 kb gap split.',
)
