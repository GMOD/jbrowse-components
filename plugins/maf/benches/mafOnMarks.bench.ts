// The MAF display's own path beside the mark display's over one fetched region
// of the synthetic MAF-tabix fixture: what each does with the same `MafFeature`s
// once they have arrived, for the base cells and for the identity plot, with
// the mark display's steps run two ways — over `Feature` objects as they ship,
// and over typed columns as `packages/core/benches/columnSteps.ts` runs them.
//
//   npx esbuild plugins/maf/benches/mafOnMarks.bench.ts --bundle \
//     --platform=node --format=esm --outfile=/tmp/mafOnMarks.mjs \
//     --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
//   node --max-old-space-size=12000 /tmp/mafOnMarks.mjs [--rounds=7] [--binBp=64] [--json]
//
// Bundled rather than run as `node <file>.ts`: `mafWirePacker.ts` declares
// parameter properties, which strip-only TypeScript refuses, and the adapter's
// imports reach a `.tsx`. `--stages` and `--column-stages` time each path's
// steps one by one instead.
//
// The fetch is shared and left out: both paths read the same adapter, and
// `MafFeature` holds its parse eagerly, so one fetch serves every round.
//
//   maf              the worker's pack (`MafWirePacker`, as
//                    `executeMafAlignmentData` feeds it), then the main
//                    thread's `placeMafRegionData` and `buildMafChannels` at
//                    one bp a cell
//   control          the same, declared a second time
//   marks            the `marks_maf_cells` span (`flatten` over `alignments`,
//                    `cells`, split on `species`) through `layerTables` as
//                    `layerFeatures` runs it, then `encodeFeatures` over the
//                    span's lanes. Before ADR-191 this was the Feature steps,
//                    which ADR-190's records hold.
//   marks-no-index   the same without the hit index, which the MAF display's
//                    hover does without
//   columns          the same steps over columns, the hit index included
//   columns-rows     the facet ordering the species rows ahead of `cells`, so
//                    each row's runs come out together and in order and a
//                    hover needs only where each row starts: no hit index
//   maf-identity     the pack, the placement and `buildIdentityRuns` at `binBp`
//   marks-identity   the same with `bin` at `binBp` and `aggregate mean` over
//                    `match` behind `cells`, which is what a config can declare
//                    today and not the identity: a run counts once, in its
//                    start's bin
//   columns-identity the column `cells`, then `bin` cutting each run at the
//                    bin edges and a mean weighted by the bases each piece puts
//                    in its bin
//
// Three checks run before any timing. The column cells must equal the Feature
// steps' run for run (extent, row, colour, the `base` a text mark reads) with
// the same colour key; the row lookup must answer what the hit index answers
// at random hovers; and the column identity must equal bases matched over
// bases compared per species and bin, counted straight off the text.
//
// The `maf` arms leave out the worker's coverage, which the MAF display always
// computes for its band, and encode every base where the display samples one
// per window once a base is under half a pixel: both favour the other arms.
//
// Interleaved round-robin with the order rotated each round, MIN across rounds
// (agent-docs/reference/BENCHMARKING.md). Each arm's instance count prints
// beside its time, since a cheaper arm that draws less is not cheaper.
import { performance } from 'node:perf_hooks'

import {
  facetLayers,
  layerTables,
  runTransforms,
} from '@jbrowse/core/util/featureTransforms'
import createJexlInstance from '@jbrowse/core/util/jexl'
import { encodeFeatures, hitIndexOf } from '@jbrowse/core/util/markEncoding'
import {
  BedTabixAdapter,
  bedTabixConfigSchema as BedTabixConfigSchema,
} from '@jbrowse/plugin-bed'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import {
  binnedMeanColumns,
  cellsColumns,
  cellsColumnsBytes,
  encodeSpanColumns,
  facetRows,
  flattenRecords,
  orderBySection,
  resolve,
  sectionRows,
  spanHitsInRow,
} from '../../../packages/core/benches/columnSteps.ts'
import { EMPTY_MAF_COVERAGE } from '../src/LinearMafDisplay/encodeMafRows.ts'
import { placeMafRegionData } from '../src/LinearMafDisplay/placeMafRows.ts'
import { MafWirePacker } from '../src/LinearMafGetAlignmentDataRpc/mafWirePacker.ts'
import { buildIdentityRuns } from '../src/LinearMafRenderer/identity.ts'
import { buildMafChannels } from '../src/LinearMafRenderer/mafChannels.ts'
import MafTabixAdapter from '../src/MafTabixAdapter/MafTabixAdapter.ts'
import MafTabixConfigSchema from '../src/MafTabixAdapter/configSchema.ts'
import { DEFAULT_SPEC, ensureMafTabixFixture } from './mafTabixFixture.ts'

import type { MafWireRegionData } from '../src/LinearMafRenderer/mafRenderingBackendTypes.ts'
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
const stages =
  process.argv.includes('--stages') || process.argv.includes('--column-stages')

// The first shape is MAF_WORKER_PIPELINE.md's profile, the second the narrow
// blocks MAF_LARGE_BLOCKS.md measures real files at, and the third a 470-way
// alignment's species count, the hg38 track the mark display's MAF example
// reads, over a 200 kb stretch.
const SHAPES: { name: string; spec: MafFixtureSpec }[] = [
  { name: '26 species, 1600 blocks of 250 columns', spec: DEFAULT_SPEC },
  {
    name: '26 species, 20000 blocks of 8 columns',
    spec: { ...DEFAULT_SPEC, blocks: 20000, columns: 8, spacing: 10 },
  },
  {
    name: '470 species, 200 blocks of 250 columns',
    spec: { ...DEFAULT_SPEC, blocks: 200, species: 470 },
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
const COLUMN_ENCODING = {
  color: CELLS_ENCODING.color as {
    field: string
    domain: string[]
    range: string[]
  },
}

// The facet's rows over the identity bins' keys: what the bar encodes as
// `row` beside the bins' own start, end and mean.
function columnIdentityRows(bins: ReturnType<typeof binnedMeanColumns>) {
  const order = [...bins.key.values].sort()
  const rowOf = Uint32Array.from(bins.key.values, v => order.indexOf(v))
  const row = new Uint32Array(bins.length)
  for (let i = 0; i < bins.length; i++) {
    row[i] = rowOf[bins.key.codes[i]!]!
  }
  return row
}

const IDENTITY_STEPS: TransformStep[] = [
  { type: 'bin', step: binBp },
  {
    type: 'aggregate',
    groupby: ['start', 'end'],
    ops: [{ op: 'mean', field: 'match', as: 'identity' }],
  },
]

// The wire the MAF display places, less the coverage the worker adds beside
// the pack: placement reads none of it.
function pack(features: readonly Feature[]): MafWireRegionData {
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
  return { ...packer.finishBlocks(), coverage: EMPTY_MAF_COVERAGE }
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
  const { layers } = layerTables(
    features,
    { transform: SHARED, facet: FACET, layers: [{}] },
    jexl,
  )
  const { table: cells, row } = layers[0]!
  return encodeFeatures(cells, { ...CELLS_ENCODING, row }, SPAN_LANES, {
    jexl,
  }).count
}
function armMarksNoIndex(features: readonly Feature[]) {
  const { layers } = layerTables(
    features,
    { transform: SHARED, facet: FACET, layers: [{}] },
    jexl,
  )
  const { table: cells, row } = layers[0]!
  return encodeFeatures(
    cells,
    { ...CELLS_ENCODING, row },
    SPAN_LANES_NO_INDEX,
    { jexl },
  ).count
}
function armColumns(features: readonly Feature[]) {
  const rows = flattenRecords(features, 'alignments', 'species')
  const runs = cellsColumns(rows)
  const { row } = facetRows(runs, 'species')
  return encodeSpanColumns(runs, COLUMN_ENCODING, row, true).count
}
function armColumnsRows(features: readonly Feature[]) {
  const rows = flattenRecords(features, 'alignments', 'species')
  const { table, section, sections } = orderBySection(rows, 'species')
  const runs = cellsColumns(table)
  const { row } = sectionRows(runs, section, sections.length)
  return encodeSpanColumns(runs, COLUMN_ENCODING, row, false).count
}
function armColumnsRowsBytes(features: readonly Feature[]) {
  const rows = flattenRecords(features, 'alignments', 'species')
  const { table, section, sections } = orderBySection(rows, 'species')
  const runs = cellsColumnsBytes(table)
  const { row } = sectionRows(runs, section, sections.length)
  return encodeSpanColumns(runs, COLUMN_ENCODING, row, false).count
}
function armColumnsIdentity(features: readonly Feature[]) {
  const rows = flattenRecords(features, 'alignments', 'species')
  const runs = cellsColumns(rows)
  const bins = binnedMeanColumns(runs, binBp, 'match', 'species')
  return columnIdentityRows(bins).length
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
  const { layers } = layerTables(
    features,
    {
      transform: SHARED,
      facet: FACET,
      layers: [{ transform: IDENTITY_STEPS }],
    },
    jexl,
  )
  const { table: bins, row } = layers[0]!
  return encodeFeatures(bins, { y: 'identity', row }, BAR_LANES, {
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

function tuplesOf(
  x: Uint32Array,
  x2: Uint32Array,
  row: Uint32Array,
  extra: readonly unknown[],
) {
  return Array.from(x, (_, i) =>
    [x[i], x2[i], row[i], extra[i]].join(':'),
  ).sort()
}

// The column cells against the Feature steps, run for run: extent, row,
// colour, and the base a text mark would read.
function checkCells(features: readonly Feature[]) {
  const shared = runTransforms(features, SHARED, jexl)
  const { layers } = facetLayers(shared, FACET, [{}], jexl)
  const { table: cells, rows } = layers[0]!
  const want = encodeFeatures(
    cells,
    { ...CELLS_ENCODING, row: rows },
    SPAN_LANES_NO_INDEX,
    { jexl },
  )
  const wantBase = Array.from(
    want.featureIndex,
    (fi, k) => `${want.color[k]}/${cells.row(fi).get('base') ?? ''}`,
  )
  const runs = cellsColumns(flattenRecords(features, 'alignments', 'species'))
  const { row } = facetRows(runs, 'species')
  const got = encodeSpanColumns(runs, COLUMN_ENCODING, row, false)
  const base = resolve(runs, 'base').column as readonly (string | undefined)[]
  const gotBase = Array.from(got.color!, (c, i) => `${c}/${base[i] ?? ''}`)
  const a = tuplesOf(want.x, want.x2, want.row, wantBase)
  const b = tuplesOf(got.x, got.x2, got.row!, gotBase)
  const first = a.findIndex((t, i) => t !== b[i])
  if (a.length !== b.length || first >= 0) {
    throw new Error(
      `column cells differ from the Feature steps: ${a.length} vs ${b.length} runs, first ${a[first]} vs ${b[first]}`,
    )
  }
  const want2 = JSON.stringify(want.scale)
  const got2 = JSON.stringify(got.scale)
  if (want2 !== got2) {
    throw new Error(`the colour keys differ: ${want2} vs ${got2}`)
  }
}

// The row-major column cells against the unordered ones, and their per-row
// lookup against the hit index over the same lanes, at random hovers.
function checkRowMajor(features: readonly Feature[]) {
  const flat = flattenRecords(features, 'alignments', 'species')
  const loose = cellsColumns(flat)
  const want = encodeSpanColumns(
    loose,
    COLUMN_ENCODING,
    facetRows(loose, 'species').row,
    false,
  )
  const { table, section, sections } = orderBySection(flat, 'species')
  const runs = cellsColumns(table)
  const { row, offsets } = sectionRows(runs, section, sections.length)
  const got = encodeSpanColumns(runs, COLUMN_ENCODING, row, false)
  const a = tuplesOf(want.x, want.x2, want.row!, Array.from(want.color!))
  const b = tuplesOf(got.x, got.x2, got.row!, Array.from(got.color!))
  if (a.length !== b.length || a.some((t, i) => t !== b[i])) {
    throw new Error('row-major column cells differ from the unordered ones')
  }
  const viaBytes = cellsColumnsBytes(table)
  const bytesEncoded = encodeSpanColumns(
    viaBytes,
    COLUMN_ENCODING,
    sectionRows(viaBytes, section, sections.length).row,
    false,
  )
  const c = tuplesOf(
    bytesEncoded.x,
    bytesEncoded.x2,
    bytesEncoded.row!,
    Array.from(bytesEncoded.color!),
  )
  if (c.length !== a.length || c.some((t, i) => t !== a[i])) {
    throw new Error(
      'the byte-walking cells differ from the string-walking ones',
    )
  }
  const index = hitIndexOf(got.x, got.x2, undefined, got.count)
  let lo = Infinity
  let hi = 0
  for (let i = 0; i < got.count; i++) {
    lo = Math.min(lo, got.x[i]!)
    hi = Math.max(hi, got.x2[i]!)
  }
  let seed = 7
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  let probes = 0
  let hits = 0
  for (let k = 0; k < 3000; k++) {
    const r = Math.floor(rand() * sections.length)
    const bp = lo + Math.floor(rand() * (hi - lo))
    const reach = Math.floor(rand() * 8)
    const byIndex = index
      .search(bp - reach, 0, bp + reach, 0)
      .filter(i => got.row![i] === r)
      .sort((p, q) => p - q)
    const byRow = spanHitsInRow(
      got.x,
      got.x2,
      offsets,
      r,
      bp - reach,
      bp + reach,
    ).sort((p, q) => p - q)
    if (byIndex.join(',') !== byRow.join(',')) {
      throw new Error(
        `row ${r} at ${bp}±${reach}: the hit index answers ${byIndex.join(',')} and the row lookup ${byRow.join(',')}`,
      )
    }
    probes++
    hits += byRow.length
  }
  return { probes, hits }
}

// Bases matched over bases compared per species and bin, straight off the
// text: the identity the MAF display means.
function identityOracle(features: readonly Feature[]) {
  const matched = new Map<string, number>()
  const compared = new Map<string, number>()
  const isGap = (b: number) => b === 45 || b === 32
  for (const f of features) {
    const ref = f.get('seq') as string
    const alignments = f.get('alignments') as Record<string, AlignmentRecord>
    for (const species in alignments) {
      const row = alignments[species]!.seq
      let pos = f.get('start')
      for (let col = 0; col < ref.length; col++) {
        const r = ref.charCodeAt(col)
        if (r === 45) {
          continue
        }
        const b = col < row.length ? row.charCodeAt(col) : 32
        if (!isGap(b)) {
          const key = `${species}:${Math.floor(pos / binBp)}`
          compared.set(key, (compared.get(key) ?? 0) + 1)
          if ((r | 0x20) === (b | 0x20)) {
            matched.set(key, (matched.get(key) ?? 0) + 1)
          }
        }
        pos++
      }
    }
  }
  return new Map(
    [...compared].map(([key, n]) => [key, (matched.get(key) ?? 0) / n]),
  )
}

// Each declared identity's distance from the oracle, and the column one held
// to it before its time is believed.
function checkIdentity(features: readonly Feature[]) {
  const oracle = identityOracle(features)
  const bins = binnedMeanColumns(
    cellsColumns(flattenRecords(features, 'alignments', 'species')),
    binBp,
    'match',
    'species',
  )
  let worstColumns = 0
  for (let i = 0; i < bins.length; i++) {
    const key = `${bins.key.values[bins.key.codes[i]!]}:${bins.start[i]! / binBp}`
    const want = oracle.get(key)
    if (want === undefined) {
      throw new Error(`the column identity has a bin the oracle lacks: ${key}`)
    }
    worstColumns = Math.max(worstColumns, Math.abs(bins.mean[i]! - want))
  }
  if (bins.length !== oracle.size || worstColumns > 1e-6) {
    throw new Error(
      `column identity off the oracle: ${bins.length} vs ${oracle.size} bins, worst ${worstColumns}`,
    )
  }
  const shared = runTransforms(features, SHARED, jexl)
  const { layers, sections } = facetLayers(
    shared,
    FACET,
    [{ transform: IDENTITY_STEPS }],
    jexl,
  )
  const keyOfRow = new Map(sections.map(s => [s.firstRow, s.key]))
  const { table: marks, rows } = layers[0]!
  let worstMarks = 0
  let sumMarks = 0
  let noValue = 0
  Array.from({ length: marks.length }, (_, i) => marks.row(i)).forEach(
    (f, i) => {
      const value = Number(f.get('identity'))
      if (!Number.isFinite(value)) {
        noValue++
        return
      }
      const key = `${keyOfRow.get(rows[i]!)}:${f.get('start') / binBp}`
      const err = Math.abs(value - (oracle.get(key) ?? 0))
      worstMarks = Math.max(worstMarks, err)
      sumMarks += err
    },
  )
  return {
    bins: bins.length,
    columnsWorst: worstColumns,
    featuresWorst: worstMarks,
    featuresMean: sumMarks / (marks.length - noValue),
    featuresNoValue: noValue,
  }
}

function time(fn: () => number) {
  const t0 = performance.now()
  const n = fn()
  return { ms: performance.now() - t0, n }
}

const asJson = process.argv.includes('--json')
const results = []
for (const { name, spec } of stages ? [] : SHAPES) {
  const features = await fetchRegion(spec)
  const species = Object.keys(
    features[0]!.get('alignments') as Record<string, unknown>,
  )
  const rowIndexBySrc = new Map(species.map((s, i) => [s, i]))

  const arms: Record<string, () => number> = {
    maf: () => armMaf(features, rowIndexBySrc),
    control: () => armControl(features, rowIndexBySrc),
    marks: () => armMarks(features),
    'marks-no-index': () => armMarksNoIndex(features),
    columns: () => armColumns(features),
    'columns-rows': () => armColumnsRows(features),
    'columns-rows-bytes': () => armColumnsRowsBytes(features),
    'maf-identity': () => armMafIdentity(features, rowIndexBySrc),
    'marks-identity': () => armMarksIdentity(features),
    'columns-identity': () => armColumnsIdentity(features),
  }
  checkCells(features)
  const lookup = checkRowMajor(features)
  const identity = checkIdentity(features)
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
  const ms = (arm: string) => Math.round(best[arm]! * 10) / 10
  results.push({
    shape: name,
    species: spec.species,
    runs: counts.columns,
    mafMs: ms('maf'),
    controlMs: ms('control'),
    featuresMs: ms('marks'),
    featuresNoIndexMs: ms('marks-no-index'),
    columnsMs: ms('columns'),
    rowMajorMs: ms('columns-rows'),
    rowMajorBytesMs: ms('columns-rows-bytes'),
    bins: identity.bins,
    mafIdentityMs: ms('maf-identity'),
    featuresIdentityMs: ms('marks-identity'),
    columnsIdentityMs: ms('columns-identity'),
    featuresWorst: Math.round(identity.featuresWorst * 1000) / 1000,
    featuresMean: Math.round(identity.featuresMean * 1000) / 1000,
    columnsWorst: Number(identity.columnsWorst.toPrecision(2)),
  })
  if (!asJson) {
    console.log(
      `\n${name}: ${features.length} blocks, identity bin ${binBp} bp, min of ${rounds}; row lookup agreed at ${lookup.probes} hovers; identity vs the oracle: columns worst ${identity.columnsWorst.toExponential(1)}, Feature steps worst ${identity.featuresWorst.toFixed(3)} mean ${identity.featuresMean.toFixed(3)}, ${identity.featuresNoValue} bins with no value`,
    )
    console.table(
      Object.keys(arms).map(arm => ({
        arm,
        ms: ms(arm),
        instances: counts[arm],
        'vs maf': (
          best[arm]! / best[arm.endsWith('identity') ? 'maf-identity' : 'maf']!
        ).toFixed(2),
      })),
    )
  }
}
if (asJson) {
  console.log(JSON.stringify({ rounds, binBp, results }, null, 2))
}

if (process.argv.includes('--stages')) {
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
      const { table: fs, rows } = layers[0]!
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

if (process.argv.includes('--column-stages')) {
  for (const { name, spec } of SHAPES) {
    const features = await fetchRegion(spec)
    const best: Record<string, number> = {}
    const lap = (label: string, t: number) => {
      best[label] = Math.min(best[label] ?? Infinity, performance.now() - t)
      return performance.now()
    }
    for (let r = 0; r < rounds; r++) {
      let t = performance.now()
      const rows = flattenRecords(features, 'alignments', 'species')
      t = lap('flatten', t)
      const { table, section, sections } = orderBySection(rows, 'species')
      t = lap('order', t)
      const runs = cellsColumns(table)
      t = lap('cells', t)
      const { row } = sectionRows(runs, section, sections.length)
      t = lap('rows', t)
      const enc = encodeSpanColumns(runs, COLUMN_ENCODING, row, false)
      t = lap('encode', t)
      hitIndexOf(enc.x, enc.x2, undefined, enc.count)
      t = lap('hit index', t)
      const packed = pack(features)
      t = lap('maf pack', t)
      const { blocks } = placeMafRegionData(
        packed,
        new Map(sections.map((s, i) => [s.key, i])),
      )
      t = lap('maf place', t)
      buildMafChannels({ blocks, palette, colorMatches: false, binBp: 1 })
      t = lap('maf channels', t)
      binnedMeanColumns(runs, binBp, 'match', 'species')
      lap('bin mean', t)
    }
    console.log(
      name,
      Object.fromEntries(
        Object.entries(best).map(([k, v]) => [k, v.toFixed(1)]),
      ),
    )
  }
}
