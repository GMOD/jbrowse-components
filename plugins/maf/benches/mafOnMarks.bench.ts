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
//   typed            the same over the table the MAF adapters answer
//                    (`mafFeatureTableOf`: the blocks packed into the MAF
//                    display's arena, inside the timing), as the mark display
//                    runs it
//   columns          the same steps over columns, the hit index included
//   columns-rows     the facet ordering the species rows ahead of `cells`, so
//                    each row's runs come out together and in order and a
//                    hover needs only where each row starts: no hit index
//   maf-identity     the pack, the placement and `buildIdentityRuns` at `binBp`
//   control-identity the same, declared a second time
//   start-bin-identity  `bin` at `binBp` by start and `aggregate mean` over
//                    `match` behind `cells`, which is not the identity: a run
//                    counts once, in its start's bin (ADR-190)
//   marks-identity   `bin` over `fields` cutting each run at the bin edges and
//                    the mean of `match` weighted by `overlap`, which one
//                    kernel runs (ADR-197), over the fetched MafFeatures
//   typed-identity   the same over the MAF adapters' table, as the display
//                    runs it: `cells`, the bin and the aggregate as one walk
//                    over the rows' bytes (`binnedCellMatches`)
//   bin-fused-typed-identity  the same with `cells` writing its runs and
//                    ADR-197's kernel binning them, the path before the walk
//   unfused-typed-identity  the same with the bin in the facet's steps and the
//                    aggregate in the layer's, so the piece table is built
//   columns-identity the bench-only lanes: the column `cells`, then
//                    `binnedMeanColumns`
//
// Checks run before any timing. The column cells must equal the Feature
// steps' run for run (extent, row, colour, the `base` a text mark reads) with
// the same colour key; the row lookup must answer what the hit index answers
// at random hovers; the column identity and the declared one must equal bases
// matched over bases compared per species and bin, counted straight off the
// text; and the declared identity must answer the same rows fused and apart,
// over the features and over the typed table. `--identity` runs the identity
// arms and their checks alone.
//
// The `maf` arms leave out the worker's coverage, which the MAF display always
// computes for its band, and encode every base where the display samples one
// per window once a base is under half a pixel: both favour the other arms.
//
// `--parse --shape=<index>` times the parse instead, one shape per process
// and with `node --expose-gc` for a collection before each arm: the adapter
// read and each worker's work after it, over MafFeatures and straight into the
// sink (`readBlocks`), for the MAF display's pack and coverage and for the
// mark display's table, steps and encode, beside the BED read alone. The
// direct path must pack and encode what the features do before any timing.
// The features arms read the parse `getFeatures` ran before it went through
// `readBlocks` (`legacyMafParse.fixture.ts`).
//
// `--readers --shape=<index>` times the two MafFeature readers `readBlocks`
// took over, parse included: `getFeatures` by the old parse and rebuilt over
// `readBlocks`, and the identity matrix clustering builds, walked over the old
// parse's MafFeatures and counted through its own sink. Each must answer what
// its old arm does before any timing.
//
// `--shape=<index>` runs one shape. Under `node --expose-gc` each arm starts
// after a collection.
//
// Interleaved round-robin with the order rotated each round, MIN across rounds
// (agent-docs/reference/BENCHMARKING.md). Each arm's instance count prints
// beside its time, since a cheaper arm that draws less is not cheaper.
import { performance } from 'node:perf_hooks'
import { isDeepStrictEqual } from 'node:util'

import {
  facetLayers,
  layerTables,
  runTransforms,
} from '@jbrowse/core/util/featureTransforms'
import createJexlInstance from '@jbrowse/core/util/jexl'
import {
  colorAt,
  encodeFeatures,
  featureIndexAt,
  hitIndexOf,
} from '@jbrowse/core/util/markEncoding'
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
import { binnedAggregate } from '../../../packages/core/src/util/binnedAggregate.ts'
import { cells } from '../../../packages/core/src/util/cellsStep.ts'
import BigBedAdapter from '../../bed/src/BigBedAdapter/BigBedAdapter.ts'
import BigBedConfigSchema from '../../bed/src/BigBedAdapter/configSchema.ts'
import BigMafAdapter from '../src/BigMafAdapter/BigMafAdapter.ts'
import BigMafConfigSchema from '../src/BigMafAdapter/configSchema.ts'
import { readIdentityMatrix } from '../src/LinearMafClusterIdentityRpc/buildIdentityMatrix.ts'
import { EMPTY_MAF_COVERAGE } from '../src/LinearMafDisplay/encodeMafRows.ts'
import { placeMafRegionData } from '../src/LinearMafDisplay/placeMafRows.ts'
import { buildMafCoverageRegion } from '../src/LinearMafGetAlignmentDataRpc/buildMafCoverageRegion.ts'
import { MafRegionSink } from '../src/LinearMafGetAlignmentDataRpc/mafRegionSink.ts'
import { MafWirePacker } from '../src/LinearMafGetAlignmentDataRpc/mafWirePacker.ts'
import { buildIdentityRuns } from '../src/LinearMafRenderer/identity.ts'
import { buildMafChannels } from '../src/LinearMafRenderer/mafChannels.ts'
import MafTabixAdapter from '../src/MafTabixAdapter/MafTabixAdapter.ts'
import MafTabixConfigSchema from '../src/MafTabixAdapter/configSchema.ts'
import {
  featureView,
  legacyBigMafFeatures,
  legacyIdentityMatrix,
  legacyMafTabixFeatures,
} from '../src/util/legacyMafParse.fixture.ts'
import { featureBlocks } from '../src/util/mafBlockSink.ts'
import {
  mafFeatureTable,
  mafFeatureTableOf,
} from '../src/util/mafFeatureTable.ts'
import {
  DEFAULT_SPEC,
  ensureBigMafFixture,
  ensureMafTabixFixture,
} from './mafTabixFixture.ts'

import type { MafWireRegionData } from '../src/LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { AlignmentRecord } from '../src/types.ts'
import type { MafAdapterBase } from '../src/util/MafAdapterBase.ts'
import type { MafFixtureSpec } from './mafTabixFixture.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { FeatureTable } from '@jbrowse/core/util/featureTable'
import type {
  AggregateStep,
  BinStep,
  LaneName,
  MarkEncodingInput,
  TransformStep,
} from '@jbrowse/core/util/markEncoding'
import type { Observable } from 'rxjs'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const num = (name: string, fallback: number) => Number(flag(name) ?? fallback)

const rounds = num('rounds', 7)
const binBp = num('binBp', 64)
const stages =
  process.argv.includes('--stages') || process.argv.includes('--column-stages')
const parse = process.argv.includes('--parse')
const readers = process.argv.includes('--readers')
const onlyIdentity = process.argv.includes('--identity')

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

// The identity as a config declares it: each run cut at the bin edges, and
// the mean of `match` weighted by the bases each piece puts in its bin.
const IDENTITY_BIN: TransformStep = {
  type: 'bin',
  step: binBp,
  fields: ['start', 'end'],
}
const IDENTITY_MEAN: TransformStep = {
  type: 'aggregate',
  groupby: ['start', 'end'],
  ops: [{ op: 'mean', field: 'match', weight: 'overlap', as: 'identity' }],
}
const IDENTITY_STEPS: TransformStep[] = [IDENTITY_BIN, IDENTITY_MEAN]
// What a config could declare before `bin` took `fields`: each run in its
// start's bin, counted once, which is ADR-190's wrong identity.
const START_BIN_STEPS: TransformStep[] = [
  { type: 'bin', step: binBp },
  {
    type: 'aggregate',
    groupby: ['start', 'end'],
    ops: [{ op: 'mean', field: 'match', as: 'identity' }],
  },
]
const IDENTITY_LANES: LaneName[] = ['y', 'row', 'color']

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
function armTyped(features: readonly Feature[]) {
  const { layers } = layerTables(
    mafFeatureTableOf(features, features[0]!.get('refName')),
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
function armControlIdentity(
  features: readonly Feature[],
  rowIndexBySrc: Map<string, number>,
) {
  const packed = pack(features)
  const { blocks } = placeMafRegionData(packed, rowIndexBySrc)
  return buildIdentityRuns(blocks, binBp).count
}
function armStartBinIdentity(features: readonly Feature[]) {
  const { layers } = layerTables(
    features,
    {
      transform: SHARED,
      facet: FACET,
      layers: [{ transform: START_BIN_STEPS }],
    },
    jexl,
  )
  const { table: bins, row } = layers[0]!
  return encodeFeatures(bins, { y: 'identity', row }, BAR_LANES, {
    jexl,
  }).count
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
  return encodeFeatures(bins, { y: 'identity', row }, IDENTITY_LANES, {
    jexl,
  }).count
}
function armTypedIdentity(features: readonly Feature[]) {
  const { layers } = layerTables(
    mafFeatureTableOf(features, features[0]!.get('refName')),
    {
      transform: SHARED,
      facet: FACET,
      layers: [{ transform: IDENTITY_STEPS }],
    },
    jexl,
  )
  const { table: bins, row } = layers[0]!
  return encodeFeatures(bins, { y: 'identity', row }, IDENTITY_LANES, {
    jexl,
  }).count
}
// The declared identity as it ran before `cells` fused with the bin: the
// species split, `cells` writing its runs, then ADR-197's bin and aggregate.
function binFusedTypedIdentity(features: readonly Feature[]) {
  const { layers } = facetLayers(
    runTransforms(mafFeatureTableOf(features, features[0]!.get('refName')), [
      SHARED[0]!,
    ]),
    FACET,
    [{}],
    jexl,
  )
  const { table, rows: sectionOfRow } = layers[0]!
  const sections = table.length ? sectionOfRow[table.length - 1]! + 1 : 0
  const bounds = new Uint32Array(sections + 1)
  for (const s of sectionOfRow) {
    bounds[s + 1]!++
  }
  for (let s = 0; s < sections; s++) {
    bounds[s + 1] = bounds[s + 1]! + bounds[s]!
  }
  const out = binnedAggregate(
    cells({ table, bounds }, { type: 'cells' }),
    IDENTITY_BIN as BinStep,
    IDENTITY_MEAN as AggregateStep,
  )!
  const row = new Uint32Array(out.table.length)
  for (let s = 0; s < sections; s++) {
    row.fill(s, out.bounds[s], out.bounds[s + 1])
  }
  return { table: out.table, rows: row }
}
function armBinFusedTypedIdentity(features: readonly Feature[]) {
  const { table, rows } = binFusedTypedIdentity(features)
  return encodeFeatures(table, { y: 'identity', row: rows }, IDENTITY_LANES, {
    jexl,
  }).count
}
// The same steps with the bin in the facet's list and the aggregate in the
// layer's, which no kernel fuses: the piece table, then the grouping.
function armUnfusedTypedIdentity(features: readonly Feature[]) {
  const { layers } = layerTables(
    mafFeatureTableOf(features, features[0]!.get('refName')),
    {
      transform: SHARED,
      facet: { ...FACET, transform: [IDENTITY_BIN] },
      layers: [{ transform: [IDENTITY_MEAN] }],
    },
    jexl,
  )
  const { table: bins, row } = layers[0]!
  return encodeFeatures(bins, { y: 'identity', row }, IDENTITY_LANES, {
    jexl,
  }).count
}

function openRegion(spec: MafFixtureSpec) {
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
  const region = {
    refName: fixture.refName,
    start: fixture.start,
    end: fixture.end,
    assemblyName: 'bench',
  }
  return { adapter, region }
}

async function fetchRegion(spec: MafFixtureSpec) {
  const { adapter, region } = openRegion(spec)
  return firstValueFrom(adapter.getFeatures(region).pipe(toArray()))
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
    { length: want.count },
    (_, k) =>
      `${colorAt(want, k)}/${cells.row(featureIndexAt(want, k)).get('base') ?? ''}`,
  )
  const runs = cellsColumns(flattenRecords(features, 'alignments', 'species'))
  const { row } = facetRows(runs, 'species')
  const got = encodeSpanColumns(runs, COLUMN_ENCODING, row, false)
  const base = resolve(runs, 'base').column as readonly (string | undefined)[]
  const gotBase = Array.from(
    { length: got.count },
    (_, i) => `${colorAt(got, i)}/${base[i] ?? ''}`,
  )
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
  const a = tuplesOf(
    want.x,
    want.x2,
    want.row!,
    Array.from(want.color as Uint32Array),
  )
  const b = tuplesOf(
    got.x,
    got.x2,
    got.row!,
    Array.from(got.color as Uint32Array),
  )
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
    Array.from(bytesEncoded.color as Uint32Array),
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
  const byStart = againstOracle(
    facetLayers(shared, FACET, [{ transform: START_BIN_STEPS }], jexl),
    oracle,
  )

  // The declared identity, over the features and over the typed table, fused
  // and apart, must be the oracle's bin for bin and one another's row for row.
  const typed = mafFeatureTableOf(features, features[0]!.get('refName'))
  const declared = [
    layerTables(
      features,
      {
        transform: SHARED,
        facet: FACET,
        layers: [{ transform: IDENTITY_STEPS }],
      },
      jexl,
    ),
    layerTables(
      typed,
      {
        transform: SHARED,
        facet: FACET,
        layers: [{ transform: IDENTITY_STEPS }],
      },
      jexl,
    ),
    layerTables(
      typed,
      {
        transform: SHARED,
        facet: { ...FACET, transform: [IDENTITY_BIN] },
        layers: [{ transform: [IDENTITY_MEAN] }],
      },
      jexl,
    ),
  ].map(({ layers, sections }) => ({
    layers: [{ table: layers[0]!.table, rows: layers[0]!.row as Uint32Array }],
    sections: sections!,
  }))
  const readBack = ({ layers }: (typeof declared)[number]) => {
    const { table, rows } = layers[0]!
    return Array.from({ length: table.length }, (_, i) => {
      const f = table.row(i)
      return [rows[i], f.get('start'), f.get('end'), f.get('identity'), f.id()]
    })
  }
  const want = readBack(declared[1]!)
  const binFused = binFusedTypedIdentity(features)
  for (const other of [
    declared[0]!,
    declared[2]!,
    { layers: [binFused], sections: declared[1]!.sections },
  ]) {
    if (!isDeepStrictEqual(readBack(other), want)) {
      throw new Error('the declared identity differs between its paths')
    }
  }
  const pipeline = againstOracle(declared[1]!, oracle)
  if (pipeline.bins !== oracle.size || pipeline.worst > 1e-9) {
    throw new Error(
      `declared identity off the oracle: ${pipeline.bins} vs ${oracle.size} bins, worst ${pipeline.worst}`,
    )
  }
  return {
    bins: bins.length,
    columnsWorst: worstColumns,
    pipelineWorst: pipeline.worst,
    featuresWorst: byStart.worst,
    featuresMean: byStart.mean,
    featuresNoValue: byStart.noValue,
  }
}

// A declared identity's distance from the oracle over the bins it answers a
// value in: the worst, the mean, and how many bins answer none.
function againstOracle(
  {
    layers,
    sections,
  }: {
    layers: { table: FeatureTable; rows: Uint32Array }[]
    sections: { firstRow: number; key: string }[]
  },
  oracle: Map<string, number>,
) {
  const keyOfRow = new Map(sections.map(s => [s.firstRow, s.key]))
  const { table, rows } = layers[0]!
  let worst = 0
  let sum = 0
  let noValue = 0
  let valued = 0
  for (let i = 0; i < table.length; i++) {
    const f = table.row(i)
    const value = Number(f.get('identity'))
    if (!Number.isFinite(value)) {
      noValue++
      continue
    }
    const key = `${keyOfRow.get(rows[i]!)}:${f.get('start') / binBp}`
    const err = Math.abs(value - (oracle.get(key) ?? Number.NaN))
    worst = Math.max(worst, Number.isNaN(err) ? Infinity : err)
    sum += err
    valued++
  }
  return { bins: valued, worst, mean: sum / valued, noValue }
}

function time(fn: () => number) {
  const t0 = performance.now()
  const n = fn()
  return { ms: performance.now() - t0, n }
}

const asJson = process.argv.includes('--json')
const results = []
const gc = (globalThis as { gc?: () => void }).gc
const oneShape = flag('shape')
for (const { name, spec } of stages || parse || readers
  ? []
  : SHAPES.filter((_, i) => oneShape === undefined || i === Number(oneShape))) {
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
    typed: () => armTyped(features),
    columns: () => armColumns(features),
    'columns-rows': () => armColumnsRows(features),
    'columns-rows-bytes': () => armColumnsRowsBytes(features),
    'maf-identity': () => armMafIdentity(features, rowIndexBySrc),
    'control-identity': () => armControlIdentity(features, rowIndexBySrc),
    'start-bin-identity': () => armStartBinIdentity(features),
    'marks-identity': () => armMarksIdentity(features),
    'typed-identity': () => armTypedIdentity(features),
    'bin-fused-typed-identity': () => armBinFusedTypedIdentity(features),
    'unfused-typed-identity': () => armUnfusedTypedIdentity(features),
    'columns-identity': () => armColumnsIdentity(features),
  }
  if (onlyIdentity) {
    for (const arm of Object.keys(arms)) {
      if (!arm.endsWith('identity')) {
        delete arms[arm]
      }
    }
  }
  const lookup = onlyIdentity
    ? { probes: 0, hits: 0 }
    : (checkCells(features), checkRowMajor(features))
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
      gc?.()
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
    typedMs: ms('typed'),
    columnsMs: ms('columns'),
    rowMajorMs: ms('columns-rows'),
    rowMajorBytesMs: ms('columns-rows-bytes'),
    bins: identity.bins,
    mafIdentityMs: ms('maf-identity'),
    controlIdentityMs: ms('control-identity'),
    featuresIdentityMs: ms('start-bin-identity'),
    pipelineIdentityMs: ms('marks-identity'),
    typedIdentityMs: ms('typed-identity'),
    binFusedIdentityMs: ms('bin-fused-typed-identity'),
    unfusedIdentityMs: ms('unfused-typed-identity'),
    columnsIdentityMs: ms('columns-identity'),
    featuresWorst: Math.round(identity.featuresWorst * 1000) / 1000,
    featuresMean: Math.round(identity.featuresMean * 1000) / 1000,
    columnsWorst: Number(identity.columnsWorst.toPrecision(2)),
    pipelineWorst: Number(identity.pipelineWorst.toPrecision(2)),
  })
  if (!asJson) {
    console.log(
      `\n${name}: ${features.length} blocks, identity bin ${binBp} bp, min of ${rounds}; row lookup agreed at ${lookup.probes} hovers; identity vs the oracle: columns worst ${identity.columnsWorst.toExponential(1)}, declared worst ${identity.pipelineWorst.toExponential(1)}, start bin worst ${identity.featuresWorst.toFixed(3)} mean ${identity.featuresMean.toFixed(3)}, ${identity.featuresNoValue} bins with no value`,
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
if (asJson && results.length) {
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

// The worker's half of each display with the parse inside the timing: the
// region read off the adapter, then for the MAF display the pack and its
// coverage, and for the mark display the table, the span's steps and the
// encode. `-features` reads MafFeatures, as every adapter did before
// `readBlocks`; `-direct` is MafTabixAdapter's parse straight into the sink.
// Written out per arm, the control included.
type LegacyRead = (region: Region) => Observable<Feature>

async function parseMafFeatures(legacy: LegacyRead, region: Region) {
  const sink = new MafRegionSink(undefined)
  await featureBlocks(legacy(region), sink)
  const packed = sink.packer.finishBlocks()
  const coverage = buildMafCoverageRegion(
    packed,
    region.start,
    region.end,
    sink.refSampleId ?? region.assemblyName,
  )
  return { packed, coverage, sink }
}
async function parseMafControl(legacy: LegacyRead, region: Region) {
  const sink = new MafRegionSink(undefined)
  await featureBlocks(legacy(region), sink)
  const packed = sink.packer.finishBlocks()
  const coverage = buildMafCoverageRegion(
    packed,
    region.start,
    region.end,
    sink.refSampleId ?? region.assemblyName,
  )
  return { packed, coverage, sink }
}
async function parseMafDirect(adapter: MafAdapterBase, region: Region) {
  const sink = new MafRegionSink(undefined)
  await adapter.readBlocks(region, sink)
  const packed = sink.packer.finishBlocks()
  const coverage = buildMafCoverageRegion(
    packed,
    region.start,
    region.end,
    sink.refSampleId ?? region.assemblyName,
  )
  return { packed, coverage, sink }
}
async function parseTypedFeatures(legacy: LegacyRead, region: Region) {
  const table = await mafFeatureTable(legacy(region), region.refName)
  const { layers } = layerTables(
    table,
    { transform: SHARED, facet: FACET, layers: [{}] },
    jexl,
  )
  const { table: cells, row } = layers[0]!
  return encodeFeatures(
    cells,
    { ...CELLS_ENCODING, row },
    SPAN_LANES_NO_INDEX,
    { jexl },
  )
}
async function parseTypedDirect(adapter: MafAdapterBase, region: Region) {
  const table = await adapter.getFeatureTable(region)
  const { layers } = layerTables(
    table,
    { transform: SHARED, facet: FACET, layers: [{}] },
    jexl,
  )
  const { table: cells, row } = layers[0]!
  return encodeFeatures(
    cells,
    { ...CELLS_ENCODING, row },
    SPAN_LANES_NO_INDEX,
    { jexl },
  )
}
async function parseBed(bed: BaseFeatureDataAdapter, region: Region) {
  const features = await firstValueFrom(bed.getFeatures(region).pipe(toArray()))
  return features.length
}

function wireOf({
  packed,
  coverage,
  sink,
}: Awaited<ReturnType<typeof parseMafDirect>>) {
  return {
    ...packed,
    coverage,
    refSampleId: sink.refSampleId,
    discovered: [...sink.discovered],
  }
}

function firstDifference(a: object, b: object) {
  const x = a as Record<string, unknown>
  const y = b as Record<string, unknown>
  return Object.keys(x).find(k => !isDeepStrictEqual(x[k], y[k]))
}

// One shape per process (`--shape=<index>`), since arms looped over several
// fixtures carry one fixture's feedback into the next; a collection before
// every arm, where node runs with --expose-gc, so no arm pays for the
// garbage of the one before it.
// The same blocks as a bigMaf, read through BigMafAdapter and its BigBed.
function openBigMaf(spec: MafFixtureSpec) {
  const fixture = ensureBigMafFixture(undefined, spec)
  const bigBedLocation = {
    localPath: fixture.bbPath,
    locationType: 'LocalPathLocation' as const,
  }
  const raw = new BigBedAdapter(BigBedConfigSchema.create({ bigBedLocation }))
  const adapter = new BigMafAdapter(
    BigMafConfigSchema.create({ bigBedLocation }),
    () =>
      Promise.resolve({
        dataAdapter: raw as BaseFeatureDataAdapter,
        sessionIds: new Set<string>(),
      }),
  )
  const region = {
    refName: fixture.refName,
    start: fixture.start,
    end: fixture.end,
    assemblyName: 'bench',
  }
  return { adapter, region, raw }
}

function openTabix(spec: MafFixtureSpec) {
  const fixture = ensureMafTabixFixture(undefined, spec)
  const bedGzLocation = {
    localPath: fixture.bedGzPath,
    locationType: 'LocalPathLocation' as const,
  }
  const index = {
    location: {
      localPath: fixture.tbiPath,
      locationType: 'LocalPathLocation' as const,
    },
  }
  const raw = new BedTabixAdapter(
    BedTabixConfigSchema.create({ bedGzLocation, index }),
  )
  const adapter = new MafTabixAdapter(
    MafTabixConfigSchema.create({ bedGzLocation, index }),
    () =>
      Promise.resolve({
        dataAdapter: raw as BaseFeatureDataAdapter,
        sessionIds: new Set<string>(),
      }),
  )
  const region = {
    refName: fixture.refName,
    start: fixture.start,
    end: fixture.end,
    assemblyName: 'bench',
  }
  return { adapter, region, raw }
}

function openFormat(spec: MafFixtureSpec) {
  const format = flag('adapter') ?? 'tabix'
  const opened = format === 'bigmaf' ? openBigMaf(spec) : openTabix(spec)
  const bed = opened.raw as BaseFeatureDataAdapter
  const legacy: LegacyRead = r =>
    format === 'bigmaf'
      ? legacyBigMafFeatures(bed, r)
      : legacyMafTabixFeatures(bed, r)
  return { ...opened, bed, format, legacy }
}

function timeArms(arms: Record<string, () => Promise<number>>) {
  const best: Record<string, number> = {}
  const counts: Record<string, number> = {}
  const only = flag('arms')?.split(',')
  const order = Object.keys(arms).filter(arm => !only || only.includes(arm))
  return (async () => {
    for (let r = 0; r < rounds; r++) {
      const rotated = [
        ...order.slice(r % order.length),
        ...order.slice(0, r % order.length),
      ]
      for (const arm of rotated) {
        gc?.()
        const t0 = performance.now()
        const n = await arms[arm]!()
        best[arm] = Math.min(best[arm] ?? Infinity, performance.now() - t0)
        counts[arm] = n
      }
    }
    const ms = (arm: string) => Math.round(best[arm]! * 10) / 10
    return { best, counts, order, ms, gc: Boolean(gc) }
  })()
}

if (readers) {
  const { name, spec } = SHAPES[num('shape', 0)]!
  const { adapter, region, format, legacy } = openFormat(spec)
  const sources = Array.from({ length: spec.species }, (_, i) => `sp${i}`)
  const featuresOf = (o: Observable<Feature>) =>
    firstValueFrom(o.pipe(toArray()))

  if (
    !isDeepStrictEqual(
      featureView(await featuresOf(legacy(region))),
      featureView(await featuresOf(adapter.getFeatures(region))),
    )
  ) {
    throw new Error('the rebuilt getFeatures answers different MafFeatures')
  }
  const matrixView = (m: Map<string, Float32Array>) =>
    [...m].map(([k, row]) => [k, [...row]])
  if (
    !isDeepStrictEqual(
      matrixView(await legacyIdentityMatrix(legacy, [region], sources)),
      matrixView(await readIdentityMatrix(adapter, [region], sources)),
    )
  ) {
    throw new Error('the identity sink counts a different matrix')
  }

  const { counts, order, ms, gc } = await timeArms({
    'features-legacy': async () => (await featuresOf(legacy(region))).length,
    'features-control': async () => (await featuresOf(legacy(region))).length,
    'features-rebuilt': async () =>
      (await featuresOf(adapter.getFeatures(region))).length,
    'identity-legacy': async () =>
      (await legacyIdentityMatrix(legacy, [region], sources)).size,
    'identity-control': async () =>
      (await legacyIdentityMatrix(legacy, [region], sources)).size,
    'identity-sink': async () =>
      (await readIdentityMatrix(adapter, [region], sources)).size,
  })
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          shape: name,
          adapter: format,
          rounds,
          gc,
          blocks: counts['features-rebuilt'],
          featuresLegacyMs: ms('features-legacy'),
          featuresControlMs: ms('features-control'),
          featuresRebuiltMs: ms('features-rebuilt'),
          identityLegacyMs: ms('identity-legacy'),
          identityControlMs: ms('identity-control'),
          identitySinkMs: ms('identity-sink'),
        },
        null,
        2,
      ),
    )
  } else {
    console.log(
      `\n${name}, ${format}: parse included, min of ${rounds}, gc ${gc}`,
    )
    console.table(
      order.map(arm => ({
        arm,
        ms: ms(arm),
        count: counts[arm],
        'vs legacy': (
          ms(arm) /
          ms(arm.startsWith('identity') ? 'identity-legacy' : 'features-legacy')
        ).toFixed(2),
      })),
    )
  }
}

if (parse) {
  const { name, spec } = SHAPES[num('shape', 0)]!
  const { adapter, region, format, bed, legacy } = openFormat(spec)

  const wireDiff = firstDifference(
    wireOf(await parseMafFeatures(legacy, region)),
    wireOf(await parseMafDirect(adapter, region)),
  )
  if (wireDiff !== undefined) {
    throw new Error(`the direct parse packs a different ${wireDiff}`)
  }
  const spanDiff = firstDifference(
    await parseTypedFeatures(legacy, region),
    await parseTypedDirect(adapter, region),
  )
  if (spanDiff !== undefined) {
    throw new Error(`the direct table encodes a different ${spanDiff}`)
  }

  const arms: Record<string, () => Promise<number>> = {
    'maf-features': async () =>
      (await parseMafFeatures(legacy, region)).packed.rowOffset.length,
    'maf-control': async () =>
      (await parseMafControl(legacy, region)).packed.rowOffset.length,
    'maf-direct': async () =>
      (await parseMafDirect(adapter, region)).packed.rowOffset.length,
    'typed-features': async () =>
      (await parseTypedFeatures(legacy, region)).count,
    'typed-direct': async () => (await parseTypedDirect(adapter, region)).count,
    bed: () => parseBed(bed, region),
  }
  const best: Record<string, number> = {}
  const counts: Record<string, number> = {}
  const only = flag('arms')?.split(',')
  const order = Object.keys(arms).filter(arm => !only || only.includes(arm))
  for (let r = 0; r < rounds; r++) {
    const rotated = [
      ...order.slice(r % order.length),
      ...order.slice(0, r % order.length),
    ]
    for (const arm of rotated) {
      gc?.()
      const t0 = performance.now()
      const n = await arms[arm]!()
      best[arm] = Math.min(best[arm] ?? Infinity, performance.now() - t0)
      counts[arm] = n
    }
  }
  const ms = (arm: string) => Math.round(best[arm]! * 10) / 10
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          shape: name,
          adapter: format,
          rounds,
          gc: Boolean(gc),
          rows: counts['maf-direct'],
          runs: counts['typed-direct'],
          mafFeaturesMs: ms('maf-features'),
          mafControlMs: ms('maf-control'),
          mafDirectMs: ms('maf-direct'),
          typedFeaturesMs: ms('typed-features'),
          typedDirectMs: ms('typed-direct'),
          bedMs: ms('bed'),
        },
        null,
        2,
      ),
    )
  } else {
    console.log(
      `\n${name}, ${format}: parse included, min of ${rounds}, gc ${Boolean(gc)}`,
    )
    console.table(
      order.map(arm => ({
        arm,
        ms: ms(arm),
        count: counts[arm],
        'vs features': (
          best[arm]! /
          best[arm.startsWith('typed') ? 'typed-features' : 'maf-features']!
        ).toFixed(2),
      })),
    )
  }
}
