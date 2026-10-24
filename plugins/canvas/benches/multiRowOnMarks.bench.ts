// The multi-row display's worker path beside the mark display's over one
// fetched region of a real painting: what each RPC executor does with the
// same features once they have arrived, including the structured clone its
// result crosses the wire by. Settles whether a `rect` mark with `rows` and a
// color can replace `MultiRowGetFeatures` at 1.00x
// (agent-docs/ideas/waiting-on-a-call/multi-row-is-the-mark-display-with-a-default-plot.md).
//
//   node --experimental-transform-types plugins/canvas/benches/multiRowOnMarks.bench.ts --only=roadmap --color=rgb
//   node --experimental-transform-types plugins/canvas/benches/multiRowOnMarks.bench.ts --only=bxd --color=field --rounds=9
//
// Transform types rather than strip them: the encoder reaches render-core's
// marks barrel, whose line mark declares a parameter property.
//
// Fixtures, one per process (BENCHMARKING.md: looping datasets through the
// same arm functions contaminates them):
//
//   roadmap  Roadmap 15-state ChromHMM, 127 epigenomes, hosted bigBed read by
//            URL; rows by `cellType`, the state in `name`, its color in the
//            BED color column. The config_demo.json track.
//   bxd      BXD chromosome painting, hosted bed.gz; rows by `sample`.
//
// --start/--end/--refName move the window, --field the color field.
//
// Two color modes, the two a shipped multi-row config writes:
//
//   --color=rgb    each feature its file's own color (`identity` with no
//                  value, or no color at all):
//     multirow       dedupe, `packMultiRowFeatures`, the clone
//     control        the same, declared a second time
//     marks-jexl     `layerTables` split on the rows field, `encodeFeatures`
//                    for a rect with a `jexl:` color building `rgb(...)` from
//                    the BED color column: the only spelling the mark display
//                    has today
//     marks-key      the same with an ordinal color over the BED color
//                    column: what a native identity scale would ask the
//                    worker for, each distinct color then parsed once on the
//                    main thread
//   --color=field  a categorical field (`name`, the state):
//     multirow, control  as above with `color.field`
//     marks-key      an ordinal color over the field, the `colorKey` lane
//
// Identity before timing: every arm's (start, end, row value, color) tuples,
// sorted, must agree with the multirow arm's; under rgb a key is parsed as
// the multi-row worker parses the column. --allow-diff times anyway.
//
// Interleaved round-robin with the order rotated each round, MIN across
// rounds (agent-docs/reference/BENCHMARKING.md). The fetch is shared and left
// out. Main-thread work after arrival (`buildMultiRowChannels` against the
// mark display's color paint and row remap) is not timed here.
import { performance } from 'node:perf_hooks'
import { serialize } from 'node:v8'

import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import { cssColorToABGR, featureItemRgb } from '@jbrowse/core/util/colorBits'
import { layerTables } from '@jbrowse/core/util/featureTransforms'
import createJexlInstance from '@jbrowse/core/util/jexl'
import {
  colorAt,
  encodeFeatures,
  encodedChannelTransferables,
} from '@jbrowse/core/util/markEncoding'

import BedTabixAdapter from '../../bed/src/BedTabixAdapter/BedTabixAdapter.ts'
import BedTabixConfigSchema from '../../bed/src/BedTabixAdapter/configSchema.ts'
import BigBedAdapter from '../../bed/src/BigBedAdapter/BigBedAdapter.ts'
import BigBedConfigSchema from '../../bed/src/BigBedAdapter/configSchema.ts'
import { packMultiRowFeatures } from '../src/MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'
import { dedupeFeaturesById } from '../src/RenderFeatureDataRPC/dedupeFeatures.ts'

import type { WorkerColor } from '../src/RenderFeatureDataRPC/renderConfig.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type {
  EncodedChannels,
  FacetSection,
} from '@jbrowse/core/util/markEncoding'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const num = (name: string, fallback: number) => Number(flag(name) ?? fallback)

const rounds = num('rounds', 7)
const colorMode = flag('color') ?? 'rgb'
const allowDiff = process.argv.includes('--allow-diff')
const jexl = createJexlInstance()

interface Fixture {
  open: () => BaseFeatureDataAdapter
  region: Region
  rowsField: string
  field: string
}

const uriLocation = (uri: string) => ({ uri, locationType: 'UriLocation' })

const bigBed = (uri: string) => () =>
  new BigBedAdapter(
    BigBedConfigSchema.create({ bigBedLocation: uriLocation(uri) }),
  ) as BaseFeatureDataAdapter

// The track's own adapter config, as its test_data entry writes it.
const bedTabix =
  (location: (p: string) => object, path: string, extra: object = {}) =>
  () =>
    new BedTabixAdapter(
      BedTabixConfigSchema.create({
        disableGeneHeuristic: true,
        ...extra,
        bedGzLocation: location(path),
        index: { location: location(`${path}.tbi`) },
      }),
    ) as BaseFeatureDataAdapter

const FIXTURES: Record<string, Fixture> = {
  roadmap: {
    open: bigBed(
      'https://jbrowse.org/demos/chromhmm/roadmap_15state_127epigenomes.bb',
    ),
    region: { refName: 'chr7', start: 25_000_000, end: 30_000_000 },
    rowsField: 'cellType',
    field: 'name',
  },
  bxd: {
    open: bedTabix(
      uriLocation,
      'https://jbrowse.org/demos/bxd/bxd_painting.bed.gz',
    ),
    region: { refName: 'chr1', start: 0, end: 195_471_971 },
    rowsField: 'sample',
    field: 'name',
  },
}

const only = flag('only') ?? 'roadmap'
const fixture = FIXTURES[only]
if (!fixture) {
  throw new Error(`--only=${only}: one of ${Object.keys(FIXTURES).join(', ')}`)
}
const region: Region = {
  ...fixture.region,
  refName: flag('refName') ?? fixture.region.refName,
  start: num('start', fixture.region.start),
  end: num('end', fixture.region.end),
}
const rowsField = fixture.rowsField
const field = flag('field') ?? fixture.field

const fetched = await fixture.open().getFeaturesArray(region)
if (fetched.length === 0) {
  throw new Error(`no features in ${JSON.stringify(region)}`)
}

// The column the multi-row worker's `featureBedColor` reads first.
const BED_COLOR_FIELDS = ['itemRgb', 'reserved', 'field8']
const colorColumn = BED_COLOR_FIELDS.find(f => fetched[0]!.get(f) !== undefined)
if (colorMode === 'rgb' && !colorColumn) {
  throw new Error(
    `no BED color column on ${JSON.stringify(fetched[0]!.toJSON())}`,
  )
}

const multiRowColor: WorkerColor =
  colorMode === 'rgb'
    ? { value: undefined, field: '', itemRgbOn: true }
    : { value: undefined, field }
const rgbExpression = `jexl:'rgb(' + feature.${colorColumn} + ')'`

function transferablesOf(value: Record<string, unknown>) {
  const buffers = new Set<ArrayBuffer>()
  for (const v of Object.values(value)) {
    if (ArrayBuffer.isView(v) && v.buffer instanceof ArrayBuffer) {
      buffers.add(v.buffer)
    }
  }
  return [...buffers]
}

// One driver per arm, written out, so no call site goes polymorphic.
function multiRowArm() {
  const features = [...dedupeFeaturesById(fetched).values()]
  const result = packMultiRowFeatures({
    features,
    rowsField,
    colorConfig: multiRowColor,
    jexl,
  })
  return structuredClone(result, { transfer: transferablesOf(result) })
}
function controlArm() {
  const features = [...dedupeFeaturesById(fetched).values()]
  const result = packMultiRowFeatures({
    features,
    rowsField,
    colorConfig: multiRowColor,
    jexl,
  })
  return structuredClone(result, { transfer: transferablesOf(result) })
}
function marksJexlArm() {
  const { layers, sections } = layerTables(
    fetched,
    { transform: [], facet: { field: rowsField }, layers: [{}] },
    jexl,
  )
  const { table, row } = layers[0]!
  const encoded = encodeFeatures(
    table,
    { x: 'start', x2: 'end', row, color: rgbExpression },
    ['row', 'color'],
    { jexl },
  )
  const result = { layers: [encoded], facet: sections }
  return structuredClone(result, {
    transfer: [...encodedChannelTransferables(encoded)] as ArrayBuffer[],
  })
}
function marksKeyArm() {
  const { layers, sections } = layerTables(
    fetched,
    { transform: [], facet: { field: rowsField }, layers: [{}] },
    jexl,
  )
  const { table, row } = layers[0]!
  const encoded = encodeFeatures(
    table,
    {
      x: 'start',
      x2: 'end',
      row,
      color: {
        field: colorMode === 'rgb' ? colorColumn! : field,
        scale: 'ordinal',
      },
    },
    ['row', 'colorKey'],
    { jexl },
  )
  const result = { layers: [encoded], facet: sections }
  return structuredClone(result, {
    transfer: [...encodedChannelTransferables(encoded)] as ArrayBuffer[],
  })
}

type MultiRowOut = ReturnType<typeof multiRowArm>
// Either marks arm: the jexl arm fills `color`, the key arm `colorKey`.
interface MarksOut {
  layers: EncodedChannels[]
  facet: FacetSection[] | undefined
}

function multiRowTuples(r: MultiRowOut) {
  const out: string[] = []
  for (let i = 0; i < r.featureStarts.length; i++) {
    const color =
      colorMode === 'rgb'
        ? r.featureColors[i]
        : r.colorValues!.values[r.rectColorValues[i]! - 1]
    out.push(
      [
        r.featureStarts[i],
        r.featureEnds[i],
        r.rowValues[r.featureRowValueIndex[i]!],
        color,
      ].join('\t'),
    )
  }
  return out.sort()
}

function rowKeysOf(sections: FacetSection[] | undefined) {
  const keys: string[] = []
  for (const { key, firstRow, rowCount } of sections ?? []) {
    for (let r = firstRow; r < firstRow + rowCount; r++) {
      keys[r] = key
    }
  }
  return keys
}

function keyColor(value: string) {
  return cssColorToABGR(featureItemRgb(value, true) ?? featureDefaultColor)
}

function marksTuples(r: MarksOut) {
  const e = r.layers[0]!
  const keys = rowKeysOf(r.facet)
  const entries = e.scale?.kind === 'categorical' ? e.scale.entries : []
  const out: string[] = []
  for (let i = 0; i < e.count; i++) {
    const color = e.colorKey
      ? colorMode === 'rgb'
        ? keyColor(entries[e.colorKey[i]!]!.value)
        : entries[e.colorKey[i]!]!.value
      : colorAt(e, i)
    out.push([e.x[i], e.x2[i], keys[e.row[i]!], color].join('\t'))
  }
  return out.sort()
}

const arms: {
  name: string
  run: () => unknown
  tuples: (r: never) => string[]
}[] = [
  { name: 'multirow', run: multiRowArm, tuples: multiRowTuples },
  { name: 'control', run: controlArm, tuples: multiRowTuples },
  ...(colorMode === 'rgb'
    ? [{ name: 'marks-jexl', run: marksJexlArm, tuples: marksTuples }]
    : []),
  { name: 'marks-key', run: marksKeyArm, tuples: marksTuples },
]

// The bytes each result holds as it crosses, measured on an uncloned copy:
// the clone transfers the typed arrays and detaches them.
function wireBytes(arm: (typeof arms)[number]) {
  return serialize(arm.run()).byteLength
}

const reference = multiRowTuples(multiRowArm())
const rowCount = new Set(reference.map(t => t.split('\t')[2])).size
console.log(
  `${only} ${region.refName}:${region.start}-${region.end}, ${fetched.length} features, ${rowCount} rows, color=${colorMode}${colorMode === 'rgb' ? ` (${colorColumn})` : ` (${field})`}`,
)
for (const arm of arms.slice(1)) {
  const got = arm.tuples(arm.run() as never)
  const at = got.findIndex((t, i) => t !== reference[i])
  if (got.length !== reference.length || at >= 0) {
    const msg = `${arm.name}: ${got.length} tuples against ${reference.length}; first difference ${JSON.stringify(got[at])} against ${JSON.stringify(reference[at])}`
    if (!allowDiff) {
      throw new Error(msg)
    }
    console.log(`IDENTITY FAILED (--allow-diff) ${msg}`)
  }
}

const best = new Map(arms.map(a => [a.name, Infinity]))
for (let round = 0; round < rounds; round++) {
  for (let k = 0; k < arms.length; k++) {
    const arm = arms[(k + round) % arms.length]!
    const t0 = performance.now()
    arm.run()
    const ms = performance.now() - t0
    best.set(arm.name, Math.min(best.get(arm.name)!, ms))
  }
}

const base = best.get('multirow')!
console.log('arm\tmin ms\tvs multirow\twire B/feature')
for (const arm of arms) {
  const ms = best.get(arm.name)!
  console.log(
    `${arm.name}\t${ms.toFixed(1)}\t${(ms / base).toFixed(2)}x\t${(wireBytes(arm) / fetched.length).toFixed(1)}`,
  )
}
