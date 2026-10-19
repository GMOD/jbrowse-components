/* eslint-disable no-console */
// How wide do the liftOver lanes draw while the anchor pans through 17p?
//
//   pnpm exec esbuild --bundle --platform=node --format=esm --target=node22 \
//     --outfile=/tmp/lanefit.mjs \
//     plugins/linear-comparative-view/benches/multiwayLaneFit.probe.ts
//   node /tmp/lanefit.mjs
//
// THE RECORD, which this rewrites: agent-docs/measurements/multiway-lane-fit.json.
//
// A 1.2 Mb hg38 window walks chr17:10-25 Mb in 100 kb steps over the eight
// liftOver lanes of demos/hg38_vertebrates, each step's decisions carried into
// the next. The whole walk is fetched at once, so a lane's holes come off more
// than any one viewport's fetch would hold: the worst case for a hole rule.
import fs from 'node:fs'
import path from 'node:path'

import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom, toArray } from 'rxjs'

import MultiPairwiseSyntenyAdapterF from '../../comparative-adapters/src/MultiPairwiseSyntenyAdapter/index.ts'
import PairwiseIndexedPAFAdapterF from '../../comparative-adapters/src/PairwiseIndexedPAFAdapter/index.ts'
import {
  decideLaneFrames,
  frameFromDecision,
} from '../src/MultiWaySyntenyDisplay/laneDecision.ts'
import {
  SPLIT_AT_GAP_BP,
  clipGroupToAnchor,
  groupFeatures,
  laneOpeningsOf,
  openedBp,
  rowAssembliesOf,
} from '../src/MultiWaySyntenyDisplay/layoutMultiWay.ts'

import type { LaneDecision } from '../src/MultiWaySyntenyDisplay/laneDecision.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { ComparativeOptions } from '@jbrowse/synteny-core'

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

const REF = 'chr17'
const FROM = 10_000_000
const TO = 25_000_000
const WINDOW_BP = 1_200_000
const STEP_BP = 100_000
const WIDTH = 1500

const { dataAdapter } = await getAdapter(
  pluginManager,
  'multiway-lane-fit-probe',
  adapterConfig,
)
const fetchOpts: ComparativeOptions = {
  clipToRegion: true,
  splitAtGapBp: SPLIT_AT_GAP_BP,
  mateShape: 'grouped',
}
const fetched = groupFeatures(
  (
    await firstValueFrom(
      (dataAdapter as BaseFeatureDataAdapter)
        .getFeaturesInMultipleRegions(
          [
            {
              refName: REF,
              start: FROM,
              end: TO + WINDOW_BP,
              assemblyName: 'hg38',
            },
          ],
          fetchOpts,
        )
        .pipe(toArray()),
    )
  )
    .filter(f => !f.get('spansWindow'))
    .map(f => new SimpleFeature(f.toJSON())),
)
const openingsOf = laneOpeningsOf(fetched)

const rungs = new Map<string, number[]>(MATES.map(m => [m, []]))
const undrawn = new Map(MATES.map(m => [m, { all: 0, missed: 0 }]))
let previous = new Map<string, LaneDecision | undefined>()
for (let start = FROM; start <= TO; start += STEP_BP) {
  const end = start + WINDOW_BP
  const groups = fetched
    .filter(g => g.anchor.end > start && g.anchor.start < end)
    .map(g =>
      clipGroupToAnchor(
        g,
        Math.max(start, g.anchor.start),
        Math.min(end, g.anchor.end),
      ),
    )
  const pxOf = (coord: number) => ((coord - start) / WINDOW_BP) * WIDTH
  const decisions = decideLaneFrames({
    groups,
    openingsOf,
    assemblyNames: rowAssembliesOf(groups, []).filter(a => a !== 'hg38'),
    anchorX: new Map(
      groups.map(g => [g.key, pxOf((g.anchor.start + g.anchor.end) / 2)]),
    ),
    anchorCoordOf: g => ({
      refName: g.anchor.refName,
      coord: (g.anchor.start + g.anchor.end) / 2,
    }),
    pxOfAnchor: c => pxOf(c.coord),
    unitBp: WINDOW_BP,
    width: WIDTH,
    previous,
  })
  for (const mate of MATES) {
    const d = decisions.get(mate)
    if (d) {
      rungs.get(mate)!.push(d.rung)
      const openings = openingsOf(mate, d.refName)
      const frame = frameFromDecision(
        d,
        pxOf(d.pivotAnchor.coord),
        WINDOW_BP,
        WIDTH,
        false,
        openings,
      )
      const tally = undrawn.get(mate)!
      for (const group of groups) {
        const bp = group.anchor.end - group.anchor.start
        for (const p of group.mates.get(mate) ?? []) {
          if (p.refName === d.refName) {
            tally.all += bp
            const lo = openedBp(openings, p.start, true)
            const hi = openedBp(openings, p.end)
            if (hi <= frame.min || lo >= frame.max) {
              tally.missed += bp
            }
          }
        }
      }
    }
  }
  previous = decisions
}

const rows = MATES.map(lane => {
  const r = rungs.get(lane)!
  let changes = 0
  let oscillations = 0
  for (let i = 1; i < r.length; i++) {
    if (r[i] !== r[i - 1]) {
      changes++
      if (i >= 2 && r[i] === r[i - 2]) {
        oscillations++
      }
    }
  }
  const { all, missed } = undrawn.get(lane)!
  return {
    values: {
      lane,
      meanRung: +(r.reduce((a, b) => a + b, 0) / r.length).toFixed(2),
      rungChanges: changes,
      rungOsc: oscillations,
      wideSteps: r.filter(x => x >= 3).length,
      undrawnPct: +((100 * missed) / Math.max(all, 1)).toFixed(1),
    },
  }
})
for (const { values } of rows) {
  console.log(Object.values(values).join('\t'))
}

const record = path.resolve('agent-docs/measurements/multiway-lane-fit.json')
const existing = JSON.parse(fs.readFileSync(record, 'utf8')) as {
  rows: unknown[]
}
existing.rows = rows
fs.writeFileSync(record, `${JSON.stringify(existing, null, 2)}\n`)
console.log(`\nwrote ${path.relative(process.cwd(), record)}`)
