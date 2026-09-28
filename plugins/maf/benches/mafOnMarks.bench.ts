// The MAF display's own path beside the mark display's over one fetched region
// of the synthetic MAF-tabix fixture: what each does with the same `MafFeature`s
// once they have arrived, for the base cells and for the identity plot.
//
//   npx esbuild plugins/maf/benches/mafOnMarks.bench.ts --bundle \
//     --platform=node --format=esm --outfile=/tmp/mafOnMarks.mjs \
//     --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
//   node --max-old-space-size=12000 /tmp/mafOnMarks.mjs [--rounds=7] [--binBp=64] [--stages]
//
// Bundled rather than run as `node <file>.ts`: `mafWirePacker.ts` declares
// parameter properties, which strip-only TypeScript refuses, and the adapter's
// imports reach a `.tsx`. `--stages` times the marks path step by step.
//
// The fetch is shared and left out: both paths read the same adapter, and
// `MafFeature` holds its parse eagerly, so one fetch serves every round.
//
//   maf            the worker's pack (`MafWirePacker`, as
//                  `executeMafAlignmentData` feeds it), then the main thread's
//                  `placeMafRegionData` and `buildMafChannels` at one bp a cell
//   control        the same, declared a second time
//   marks          `layerFeatures`' steps and facet for the `marks_maf_cells`
//                  span (`flatten` over `alignments`, `cells`, split on
//                  `species`), then `encodeFeatures` over the span's lanes
//   marks-no-index the same without the hit index, which the MAF display's
//                  hover does without
//   maf-identity   the pack, the placement and `buildIdentityRuns` at `binBp`
//   marks-identity the marks steps with `bin` at `binBp` and `aggregate mean`
//                  over `match` behind `cells`: the cheapest declared identity,
//                  and not the right one (a run counts once, in its start's bin)
//
// The `maf` arms leave out the worker's coverage, which the MAF display always
// computes for its band, and encode every base where the display samples one
// per window once a base is under half a pixel: both favour the marks arms.
//
// Interleaved round-robin with the order rotated each round, MIN across rounds
// (agent-docs/reference/BENCHMARKING.md). Each arm's instance count prints
// beside its time, since a cheaper arm that draws less is not cheaper.
import { performance } from 'node:perf_hooks'

import {
  facetLayers,
  runTransforms,
} from '@jbrowse/core/util/featureTransforms'
import createJexlInstance from '@jbrowse/core/util/jexl'
import { encodeFeatures } from '@jbrowse/core/util/markEncoding'
import {
  BedTabixAdapter,
  bedTabixConfigSchema as BedTabixConfigSchema,
} from '@jbrowse/plugin-bed'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { placeMafRegionData } from '../src/LinearMafDisplay/placeMafRows.ts'
import { MafWirePacker } from '../src/LinearMafGetAlignmentDataRpc/mafWirePacker.ts'
import { buildIdentityRuns } from '../src/LinearMafRenderer/identity.ts'
import { buildMafChannels } from '../src/LinearMafRenderer/mafChannels.ts'
import MafTabixAdapter from '../src/MafTabixAdapter/MafTabixAdapter.ts'
import MafTabixConfigSchema from '../src/MafTabixAdapter/configSchema.ts'
import { DEFAULT_SPEC, ensureMafTabixFixture } from './mafTabixFixture.ts'

import type { AlignmentRecord } from '../src/types.ts'
import type { MafFixtureSpec } from './mafTabixFixture.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type {
  LaneName,
  MarkEncodingInput,
  TransformStep,
} from '@jbrowse/core/util/markEncoding'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const num = (name: string, fallback: number) => Number(flag(name) ?? fallback)

const rounds = num('rounds', 7)
const binBp = num('binBp', 64)
const stages = process.argv.includes('--stages')

const SHAPES: { name: string; spec: MafFixtureSpec }[] = [
  { name: 'wide 1600 x 26 x 250', spec: DEFAULT_SPEC },
  {
    name: 'narrow 20000 x 26 x 8',
    spec: { ...DEFAULT_SPEC, blocks: 20000, columns: 8, spacing: 10 },
  },
]

const palette = {
  colorForBase: {
    a: '#ff0000',
    c: '#00ff00',
    g: '#0000ff',
    t: '#ffff00',
    n: '#888',
  },
  matchColor: '#d3d3d3',
  gapColor: '#1e1e1e',
  unknownBaseColor: '#000000',
  insertionColor: '#800080',
  bridgeLineColor: '#888888',
  missingDataColor: '#ffffcc',
  conservationColor: 'grey',
  codonFill: { same: undefined, syn: 'blue', nonsyn: 'orange', stop: 'red' },
}

const jexl = createJexlInstance()

// markLanes('span') less the ramp's raw values, spelled here because
// markSpecs.ts is reached through React in the marks plugin's barrel
const SPAN_LANES: LaneName[] = ['row', 'color', 'index']
const SPAN_LANES_NO_INDEX: LaneName[] = ['row', 'color']
const BAR_LANES: LaneName[] = ['y', 'row', 'color', 'index']

const SHARED: TransformStep[] = [
  { type: 'flatten', field: 'alignments', key: 'species' },
  { type: 'cells' },
]
const FACET = { field: 'species' }
const CELLS_ENCODING: MarkEncodingInput = {
  color: {
    field: 'state',
    scale: 'categorical',
    domain: ['match', 'mismatch', 'gap', 'insertion'],
    range: ['#d9d9d9', '#e41a1c', '#404040', '#984ea3'],
  },
}
const IDENTITY_STEPS: TransformStep[] = [
  { type: 'bin', step: binBp },
  {
    type: 'aggregate',
    groupby: ['start', 'end'],
    ops: [{ op: 'mean', field: 'match', as: 'identity' }],
  },
]

function pack(features: readonly Feature[]) {
  const packer = new MafWirePacker()
  for (const feature of features) {
    const alignments = feature.get('alignments') as Record<
      string,
      AlignmentRecord
    >
    packer.startBlock(feature.get('start'), feature.get('seq') as string)
    for (const sampleId in alignments) {
      const a = alignments[sampleId]!
      packer.addRow({
        sampleId,
        seq: a.seq,
        chr: a.chr,
        srcStart: a.srcStart,
        strand: a.strand ?? 1,
        srcSize: a.srcSize,
        context: a.context,
      })
    }
  }
  return packer.finishBlocks()
}

// One driver per arm, written out rather than shared, so no call site goes
// polymorphic across arms.
function armMaf(
  features: readonly Feature[],
  rowIndexBySrc: Map<string, number>,
) {
  const packed = pack(features)
  const { blocks } = placeMafRegionData(packed, rowIndexBySrc)
  return buildMafChannels({ blocks, palette, colorMatches: false, binBp: 1 })
    .count
}
function armControl(
  features: readonly Feature[],
  rowIndexBySrc: Map<string, number>,
) {
  const packed = pack(features)
  const { blocks } = placeMafRegionData(packed, rowIndexBySrc)
  return buildMafChannels({ blocks, palette, colorMatches: false, binBp: 1 })
    .count
}
function armMarks(features: readonly Feature[]) {
  const shared = runTransforms(features, SHARED, jexl)
  const { layers } = facetLayers(shared, FACET, [{}], jexl)
  const { features: cells, rows } = layers[0]!
  return encodeFeatures(cells, { ...CELLS_ENCODING, row: rows }, SPAN_LANES, {
    jexl,
  }).count
}
function armMarksNoIndex(features: readonly Feature[]) {
  const shared = runTransforms(features, SHARED, jexl)
  const { layers } = facetLayers(shared, FACET, [{}], jexl)
  const { features: cells, rows } = layers[0]!
  return encodeFeatures(
    cells,
    { ...CELLS_ENCODING, row: rows },
    SPAN_LANES_NO_INDEX,
    { jexl },
  ).count
}
function armMafIdentity(
  features: readonly Feature[],
  rowIndexBySrc: Map<string, number>,
) {
  const packed = pack(features)
  const { blocks } = placeMafRegionData(packed, rowIndexBySrc)
  return buildIdentityRuns(blocks, binBp).count
}
function armMarksIdentity(features: readonly Feature[]) {
  const shared = runTransforms(features, SHARED, jexl)
  const { layers } = facetLayers(
    shared,
    FACET,
    [{ transform: IDENTITY_STEPS }],
    jexl,
  )
  const { features: bins, rows } = layers[0]!
  return encodeFeatures(bins, { y: 'identity', row: rows }, BAR_LANES, {
    jexl,
  }).count
}

async function fetchRegion(spec: MafFixtureSpec) {
  const fixture = ensureMafTabixFixture(undefined, spec)
  const adapter = new MafTabixAdapter(
    MafTabixConfigSchema.create({
      bedGzLocation: {
        localPath: fixture.bedGzPath,
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: fixture.tbiPath,
          locationType: 'LocalPathLocation',
        },
      },
    }),
    subConf =>
      Promise.resolve({
        dataAdapter: new BedTabixAdapter(
          BedTabixConfigSchema.create(subConf),
        ) as BaseFeatureDataAdapter,
        sessionIds: new Set<string>(),
      }),
  )
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        refName: fixture.refName,
        start: fixture.start,
        end: fixture.end,
        assemblyName: 'bench',
      })
      .pipe(toArray()),
  )
  return features
}

function time(fn: () => number) {
  const t0 = performance.now()
  const n = fn()
  return { ms: performance.now() - t0, n }
}

for (const { name, spec } of stages ? [] : SHAPES) {
  const features = await fetchRegion(spec)
  const species = Object.keys(
    features[0]!.get('alignments') as Record<string, unknown>,
  )
  const rowIndexBySrc = new Map(species.map((s, i) => [s, i]))
  const cells = spec.blocks * spec.species * spec.columns

  const arms: Record<string, () => number> = {
    maf: () => armMaf(features, rowIndexBySrc),
    control: () => armControl(features, rowIndexBySrc),
    marks: () => armMarks(features),
    'marks-no-index': () => armMarksNoIndex(features),
    'maf-identity': () => armMafIdentity(features, rowIndexBySrc),
    'marks-identity': () => armMarksIdentity(features),
  }
  const best: Record<string, number> = {}
  const counts: Record<string, number> = {}
  for (let r = 0; r < rounds; r++) {
    const order = Object.keys(arms)
    const rotated = [
      ...order.slice(r % order.length),
      ...order.slice(0, r % order.length),
    ]
    for (const arm of rotated) {
      const { ms, n } = time(arms[arm]!)
      best[arm] = Math.min(best[arm] ?? Infinity, ms)
      counts[arm] = n
    }
  }
  console.log(
    `\n${name}: ${features.length} blocks, ${(cells / 1e6).toFixed(1)}M cells, identity bin ${binBp} bp, min of ${rounds}`,
  )
  const rows = Object.keys(arms).map(arm => ({
    arm,
    ms: best[arm]!.toFixed(1),
    instances: counts[arm],
    'vs maf': (
      best[arm]! / best[arm.endsWith('identity') ? 'maf-identity' : 'maf']!
    ).toFixed(2),
  }))
  console.table(rows)
}

if (stages) {
  for (const { name, spec } of SHAPES) {
    const features = await fetchRegion(spec)
    const best: Record<string, number> = {}
    for (let r = 0; r < rounds; r++) {
      let t = performance.now()
      const flat = runTransforms(features, [SHARED[0]!], jexl)
      best.flatten = Math.min(best.flatten ?? Infinity, performance.now() - t)
      t = performance.now()
      const cellRuns = runTransforms(flat, [SHARED[1]!], jexl)
      best.cells = Math.min(best.cells ?? Infinity, performance.now() - t)
      t = performance.now()
      const { layers } = facetLayers(cellRuns, FACET, [{}], jexl)
      best.facet = Math.min(best.facet ?? Infinity, performance.now() - t)
      t = performance.now()
      const { features: fs, rows } = layers[0]!
      encodeFeatures(fs, { ...CELLS_ENCODING, row: rows }, SPAN_LANES, { jexl })
      best.encode = Math.min(best.encode ?? Infinity, performance.now() - t)
      t = performance.now()
      const packed = pack(features)
      best.pack = Math.min(best.pack ?? Infinity, performance.now() - t)
      t = performance.now()
      const species = Object.keys(
        features[0]!.get('alignments') as Record<string, unknown>,
      )
      const { blocks } = placeMafRegionData(
        packed,
        new Map(species.map((s, i) => [s, i])),
      )
      best.place = Math.min(best.place ?? Infinity, performance.now() - t)
      t = performance.now()
      buildMafChannels({ blocks, palette, colorMatches: false, binBp: 1 })
      best.channels = Math.min(best.channels ?? Infinity, performance.now() - t)
    }
    console.log(
      name,
      Object.fromEntries(
        Object.entries(best).map(([k, v]) => [k, v.toFixed(1)]),
      ),
    )
  }
}
