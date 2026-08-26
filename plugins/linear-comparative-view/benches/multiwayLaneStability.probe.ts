/* eslint-disable no-console */
// Does a multi-way lane hold still while the anchor pans?
//
//   pnpm exec esbuild --bundle --platform=node --format=esm --target=node22 \
//     --outfile=/tmp/lanestab.mjs \
//     plugins/linear-comparative-view/benches/multiwayLaneStability.probe.ts
//   node /tmp/lanestab.mjs
//
// Bundled rather than run through node's type stripping, which cannot load the
// `.tsx` the adapter cache reaches — the same reason `syntenyRpc.bench.ts`
// bundles its driver.
//
// THE RECORD, which this rewrites: agent-docs/measurements/multiway-lane-stability.json.
//
// THE QUESTION. `decideLaneFrames` decides four things per settle — contig,
// orientation, ladder rung, placement — and carries the previous decision in,
// the way `SyntenyFollow` carries its own: `preferIncumbent` on every discrete
// choice, because "panning a window across a fusion breakpoint moves summed
// overlap from one mate contig to the other, and the two are equal at the
// midpoint". Grape/peach/cacao is paleohexaploid, so a grape window reaching
// several peach chromosomes is the ordinary case rather than the edge.
//
// This says whether an incumbent holds. It calls `decideLaneFrames` itself,
// step after step with each step's decision carried into the next — the answer
// has to come from the function that decides, not from a second copy of its
// tally — and walks a window across a chromosome recording what each lane
// comes out as. `fallback` is the anchor-order sign sum a fresh lane falls back
// on, from `computeRowFrame` with no incumbent, kept as the control.
//
// A CHANGE IS NOT A FLICKER. A lane moving from one syntenic block to the next
// changes contig once and stays, which is the data and not a defect; a lane on a
// near-tie oscillates A -> B -> A over a pan the reader sees as smooth. Only the
// second is reported as jitter, and the two are counted apart.
//
// THE REAL TRACK, over the network: `test_data/multiway_blocks` is four blocks
// on a 1000bp contig, which is a smoke fixture and cannot answer this.
import fs from 'node:fs'
import path from 'node:path'

import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import { firstValueFrom, toArray } from 'rxjs'

import configSchema from '../../comparative-adapters/src/MCScanBlocksAdapter/configSchema.ts'
import {
  computeRowFrame,
  decideLaneFrames,
} from '../src/MultiWaySyntenyDisplay/laneDecision.ts'
import {
  groupFeatures,
  rowAssembliesOf,
} from '../src/MultiWaySyntenyDisplay/layoutMultiWay.ts'

import type { LaneDecision } from '../src/MultiWaySyntenyDisplay/laneDecision.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

class BlocksOnly extends Plugin {
  name = 'BlocksOnly'
  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'MCScanBlocksAdapter',
          displayName: 'MCScan blocks adapter',
          configSchema,
          getAdapterClass: () =>
            import('../../comparative-adapters/src/MCScanBlocksAdapter/MCScanBlocksAdapter.ts').then(
              r => r.default,
            ),
        }),
    )
  }
}

const pluginManager = new PluginManager([new BlocksOnly()])
pluginManager.createPluggableElements()
pluginManager.configure()

const BASE = 'https://jbrowse.org/demos/grape_peach_cacao'
const uri = (name: string) => ({
  uri: `${BASE}/${name}`,
  locationType: 'UriLocation' as const,
})

// Verbatim from the deployed demo's own track, so what this measures is what a
// reader is looking at. Seven columns, three of which the config declares as
// assemblies and four of which are blocks-only mates — every one is a lane.
const ASSEMBLIES = [
  'grape',
  'peach',
  'cacao',
  'arabidopsis',
  'poplar',
  'tomato',
  'citrus',
]
const adapterConfig = {
  type: 'MCScanBlocksAdapter',
  mcscanBlocksLocation: uri('grape.blocks.gz'),
  blockAssemblies: ASSEMBLIES,
  bedLocations: ASSEMBLIES.map(a => uri(`${a}.bed.gz`)),
  assemblyNames: ASSEMBLIES,
}

// grape chr1, whose RefSeq accession and length are in
// agent-docs/reference/DEMO_DATASETS.md
const ANCHOR_REF = 'NC_081805.1'
const ANCHOR_BP = 27_800_000
const ANCHOR_ASSEMBLY = 'grape'

// The pan: a window of WINDOW_BP walked across the chromosome in STEP_BP steps.
// The step is a small fraction of the window, so consecutive steps share nearly
// all their groups — a lane that changes contig between two of them changed it
// over a few percent of its own evidence, which is the state this is about.
const WINDOW_BP = 2_000_000
const STEP_BP = 100_000

async function anchorFeatures() {
  const { dataAdapter } = await getAdapter(
    pluginManager,
    'multiway-lane-stability-probe',
    adapterConfig,
  )
  return firstValueFrom(
    (dataAdapter as BaseFeatureDataAdapter)
      .getFeatures({
        refName: ANCHOR_REF,
        start: 0,
        end: ANCHOR_BP,
        assemblyName: ANCHOR_ASSEMBLY,
      })
      .pipe(toArray()),
  )
}

// `MultiWaySyntenyDisplay.visibleGroups`, without the view: a group is in the
// window when its ANCHOR placement overlaps it. The mate placements are what
// the lane is then fitted to, which is the whole point — the reader drives the
// anchor and the lanes follow.
function inWindow(
  groups: ReturnType<typeof groupFeatures>,
  start: number,
  end: number,
) {
  return groups.filter(
    g =>
      g.anchor.refName === ANCHOR_REF &&
      g.anchor.end > start &&
      g.anchor.start < end,
  )
}

// The anchor lane's own px, which is the first link of `alignRowFrames`' chain.
// Linear because the walk stays on one contig, where the view's piecewise
// `bpToPx` is linear too — the same stand-in `layoutMultiWay.test.ts` uses.
function anchorSeed(
  visible: ReturnType<typeof groupFeatures>,
  start: number,
  width: number,
) {
  return new Map(
    visible.map(g => [
      g.key,
      (((g.anchor.start + g.anchor.end) / 2 - start) / WINDOW_BP) * width,
    ]),
  )
}

interface LaneRun {
  refNames: (string | undefined)[]
  // what `computeRowFrame` alone answers: the anchor-order sign sum, which is
  // the FALLBACK
  fitFlip: (boolean | undefined)[]
  // and what the display draws, once the vote against the lane above and the
  // incumbent have had their say
  drawnFlip: (boolean | undefined)[]
  rungs: (number | undefined)[]
}

// How many times a series leaves a value and comes back to it within `reach`
// steps — the shape a near-tie makes, as against a lane that moves on and stays
// moved. `reach` is in steps, so at STEP_BP it is a fraction of one window.
function oscillations<T>(series: T[], reach: number) {
  let count = 0
  for (let i = 1; i < series.length; i++) {
    if (series[i] === series[i - 1]) {
      continue
    }
    // it changed here; did it change back before `reach` more steps?
    for (let j = i + 1; j <= Math.min(i + reach, series.length - 1); j++) {
      if (series[j] === series[i - 1]) {
        count++
        break
      }
    }
  }
  return count
}

function changes<T>(series: T[]) {
  let count = 0
  for (let i = 1; i < series.length; i++) {
    if (series[i] !== series[i - 1]) {
      count++
    }
  }
  return count
}

const features = await anchorFeatures()
const groups = groupFeatures(features)
const lanes = rowAssembliesOf(groups, [], (a, b) => a === b).filter(
  a => a !== ANCHOR_ASSEMBLY,
)
console.log(
  `${features.length} pairwise features, ${groups.length} groups, ${lanes.length} lanes`,
)

const WIDTH = 1280

const runs = new Map<string, LaneRun>(
  lanes.map(a => [a, { refNames: [], fitFlip: [], drawnFlip: [], rungs: [] }]),
)
let steps = 0
// carried from step to step, the way the display carries it from settle to
// settle — what the incumbent rule has to hold on to
let previous = new Map<string, LaneDecision | undefined>()
for (let start = 0; start + WINDOW_BP <= ANCHOR_BP; start += STEP_BP) {
  const visible = inWindow(groups, start, start + WINDOW_BP)
  steps++
  // WINDOW_BP is `visibleBpSpan`, which is what the ladder rounds against and
  // what `keepNearMedian`'s reach is scaled by — so these are the calls the
  // display makes, not approximations of them
  const drawn = decideLaneFrames({
    groups: visible,
    assemblyNames: lanes,
    anchorX: anchorSeed(visible, start, WIDTH),
    anchorCoordOf: g => ({
      refName: g.anchor.refName,
      coord: (g.anchor.start + g.anchor.end) / 2,
    }),
    pxOfAnchor: c => ((c.coord - start) / WINDOW_BP) * WIDTH,
    unitBp: WINDOW_BP,
    width: WIDTH,
    previous,
  })
  previous = drawn
  for (const assemblyName of lanes) {
    const run = runs.get(assemblyName)!
    const decision = drawn.get(assemblyName)
    run.refNames.push(decision?.refName)
    run.fitFlip.push(computeRowFrame(visible, assemblyName, WINDOW_BP)?.flipped)
    run.drawnFlip.push(decision?.flipped)
    run.rungs.push(decision?.rung)
  }
}

// Within a fifth of a window: far enough that a lane genuinely moving on has
// left, close enough that coming back is the same evidence changing its mind.
const REACH = Math.round(WINDOW_BP / STEP_BP / 5)

console.log(
  `\n${steps} steps of ${STEP_BP / 1000}kb across a ${WINDOW_BP / 1e6}Mb window on ${ANCHOR_REF}\n`,
)
console.log(
  '                 contig            drawn flip        fallback flip      rung',
)
console.log(
  'lane            n  chg  osc     chg  osc         chg  osc   empty   chg  osc',
)
const rows: Record<string, string | number>[] = []
for (const [assemblyName, run] of runs) {
  const seen = new Set(run.refNames.filter(r => r !== undefined))
  const empty = run.refNames.filter(r => r === undefined).length
  const values = {
    lane: assemblyName,
    contigs: seen.size,
    contigChanges: changes(run.refNames),
    contigOsc: oscillations(run.refNames, REACH),
    drawnFlipChanges: changes(run.drawnFlip),
    drawnFlipOsc: oscillations(run.drawnFlip, REACH),
    fallbackFlipChanges: changes(run.fitFlip),
    fallbackFlipOsc: oscillations(run.fitFlip, REACH),
    empty,
    rungChanges: changes(run.rungs),
    rungOsc: oscillations(run.rungs, REACH),
  }
  rows.push(values)
  console.log(
    [
      assemblyName.padEnd(14),
      String(values.contigs).padStart(2),
      String(values.contigChanges).padStart(5),
      String(values.contigOsc).padStart(5),
      String(values.drawnFlipChanges).padStart(8),
      String(values.drawnFlipOsc).padStart(5),
      String(values.fallbackFlipChanges).padStart(12),
      String(values.fallbackFlipOsc).padStart(5),
      String(empty).padStart(8),
      String(values.rungChanges).padStart(6),
      String(values.rungOsc).padStart(5),
    ].join(''),
  )
}
const record = path.resolve(
  'agent-docs/measurements/multiway-lane-stability.json',
)
const existing = JSON.parse(fs.readFileSync(record, 'utf8')) as {
  columns: { key: string; label: string; format: string; align: string }[]
  rows: { values: Record<string, string | number> }[]
}
const rungColumns = [
  { key: 'rungChanges', label: 'rung chg', format: 'int', align: 'right' },
  { key: 'rungOsc', label: 'rung osc', format: 'int', align: 'right' },
]
existing.columns = [
  ...existing.columns.filter(c => !rungColumns.some(r => r.key === c.key)),
  ...rungColumns,
]
existing.rows = rows.map(values => ({ values }))
fs.writeFileSync(record, `${JSON.stringify(existing, null, 2)}\n`)
console.log(`\nwrote ${path.relative(process.cwd(), record)}`)
console.log(
  '\nchg: consecutive steps whose answer differs. osc: those that go back within\n' +
    'a fifth of a window, which is the near-tie rather than the data. "drawn" is\n' +
    '`alignRowFrames`, which is what a reader sees; "fallback" is the lane\'s own\n' +
    'anchor-order vote, which only decides where the drawn one abstains.',
)
