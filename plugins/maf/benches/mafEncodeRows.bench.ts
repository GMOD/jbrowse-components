// What `encodeMafRows` costs the main thread per fetch, apart from the
// placement it follows, over a contiguous stretch of the synthetic MAF-tabix
// fixture at the windows where bases draw (below a 20 kb visible span; the
// fetch is twice the visible span, and `binBp` follows `subPixelBinBp`).
//
//   npx esbuild plugins/maf/benches/mafEncodeRows.bench.ts --bundle --platform=node --format=esm --outfile=/tmp/mafEncodeRows.mjs --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" && node --expose-gc --max-old-space-size=12000 /tmp/mafEncodeRows.mjs [--rounds=15] [--json]
//
// Arms per point, interleaved with the order rotated, MIN across rounds. Every
// arm but `place` and `sum` runs over a region placed fresh and untimed just
// before it: `mafInsertionChannels` caches its walk in a WeakMap keyed by the
// region, so a reused region skips the walk and a real fetch, which always
// lands a new region, pays it.
//   place       `placeMafRegionData` over the packed wire
//   channels    `buildMafChannels` over a cold region
//   insertions  `mafInsertionChannels` over a cold region
//   encode      `encodeMafRows` whole, over a cold region
//   control     the same encode declared a second time; far from 1.00 means
//               the row measured nothing
//   sum         place then encode in one call, as a fetch's landing pays
import { performance } from 'node:perf_hooks'

import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import {
  BedTabixAdapter,
  bedTabixConfigSchema as BedTabixConfigSchema,
} from '@jbrowse/plugin-bed'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import {
  EMPTY_MAF_COVERAGE,
  encodeMafRows,
} from '../src/LinearMafDisplay/encodeMafRows.ts'
import { placeMafRegionData } from '../src/LinearMafDisplay/placeMafRows.ts'
import { MafWirePacker } from '../src/LinearMafGetAlignmentDataRpc/mafWirePacker.ts'
import { buildMafChannels } from '../src/LinearMafRenderer/mafChannels.ts'
import { mafInsertionChannels } from '../src/LinearMafRenderer/rendering/insertions.ts'
import MafTabixAdapter from '../src/MafTabixAdapter/MafTabixAdapter.ts'
import MafTabixConfigSchema from '../src/MafTabixAdapter/configSchema.ts'
import { DEFAULT_SPEC, ensureMafTabixFixture } from './mafTabixFixture.ts'

import type { MafRowsEncodeProps } from '../src/LinearMafDisplay/encodeMafRows.ts'
import type { MafWireRegionData } from '../src/LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { AlignmentRecord } from '../src/types.ts'
import type { MafFixtureSpec } from './mafTabixFixture.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const rounds = Number(flag('rounds') ?? 15)
const asJson = process.argv.includes('--json')
const gc = (globalThis as { gc?: () => void }).gc

const BLOCK_COLUMNS = 250
const BLOCK_SPACING = 240
const WINDOW_START = 2000

const POINTS = [
  { fetchedBp: 15000, binBp: 1 },
  { fetchedBp: 15000, binBp: 2 },
  { fetchedBp: 40000, binBp: 8 },
]
const SPECIES = [26, 470]

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

async function fetchWindow(spec: MafFixtureSpec, fetchedBp: number) {
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
  const adapter = new MafTabixAdapter(
    MafTabixConfigSchema.create({ bedGzLocation, index }),
    () =>
      Promise.resolve({
        dataAdapter: new BedTabixAdapter(
          BedTabixConfigSchema.create({ bedGzLocation, index }),
        ) as BaseFeatureDataAdapter,
        sessionIds: new Set<string>(),
      }),
  )
  return firstValueFrom(
    adapter
      .getFeatures({
        refName: fixture.refName,
        start: WINDOW_START,
        end: WINDOW_START + fetchedBp,
        assemblyName: 'bench',
      })
      .pipe(toArray()),
  )
}

function encodePropsOf(
  binBp: number,
  rowIndexBySrc: Map<string, number>,
): MafRowsEncodeProps {
  return {
    basesActive: true,
    identity: undefined,
    identityColors: new Uint32Array(101),
    gpu: { palette, colorMatches: false, binBp },
    sourceChromRanks: undefined,
    sourceChromColors: [],
    rowIndexBySrc,
    codons: undefined,
    conservation: false,
  }
}

type Placed = ReturnType<typeof placeMafRegionData>

function armPlace(
  packed: MafWireRegionData,
  rowIndexBySrc: Map<string, number>,
) {
  return placeMafRegionData(packed, rowIndexBySrc).blocks.length
}

function armChannels(detail: Placed, props: MafRowsEncodeProps) {
  return buildMafChannels({ blocks: detail.blocks, ...props.gpu }).count
}

function armInsertions(detail: Placed, props: MafRowsEncodeProps) {
  return mafInsertionChannels(
    detail,
    cssColorToABGR(props.gpu.palette.insertionColor),
    props.gpu.binBp,
  ).count
}

function armEncode(detail: Placed, props: MafRowsEncodeProps) {
  const { cells, insertions } = encodeMafRows(
    { detail, summary: undefined, frames: undefined },
    props,
  )
  return cells.count + (insertions?.count ?? 0)
}

function armControl(detail: Placed, props: MafRowsEncodeProps) {
  const { cells, insertions } = encodeMafRows(
    { detail, summary: undefined, frames: undefined },
    props,
  )
  return cells.count + (insertions?.count ?? 0)
}

function armSum(
  packed: MafWireRegionData,
  rowIndexBySrc: Map<string, number>,
  props: MafRowsEncodeProps,
) {
  const detail = placeMafRegionData(packed, rowIndexBySrc)
  const { cells, insertions } = encodeMafRows(
    { detail, summary: undefined, frames: undefined },
    props,
  )
  return cells.count + (insertions?.count ?? 0)
}

const results = []
for (const species of SPECIES) {
  const spec: MafFixtureSpec = {
    ...DEFAULT_SPEC,
    species,
    blocks: 200,
    columns: BLOCK_COLUMNS,
    spacing: BLOCK_SPACING,
  }
  for (const { fetchedBp, binBp } of POINTS) {
    const features = await fetchWindow(spec, fetchedBp)
    const rowIndexBySrc = new Map(
      Array.from({ length: species }, (_, i) => [`sp${i}`, i]),
    )
    const packed = pack(features)
    const props = encodePropsOf(binBp, rowIndexBySrc)
    const used = new WeakSet<object>()
    const freshRegion = () => {
      const detail = placeMafRegionData(packed, rowIndexBySrc)
      if (used.has(detail)) {
        throw new Error('a region was timed twice, so a cache could hit')
      }
      used.add(detail)
      return detail
    }
    const cold: Record<string, (d: Placed) => number> = {
      channels: d => armChannels(d, props),
      insertions: d => armInsertions(d, props),
      encode: d => armEncode(d, props),
      control: d => armControl(d, props),
    }
    const arms: Record<string, () => number> = {
      place: () => armPlace(packed, rowIndexBySrc),
      sum: () => armSum(packed, rowIndexBySrc, props),
    }
    const order = ['place', ...Object.keys(cold), 'sum']
    const best: Record<string, number> = {}
    const counts: Record<string, number> = {}
    for (let r = 0; r < rounds + 2; r++) {
      const rotated = [
        ...order.slice(r % order.length),
        ...order.slice(0, r % order.length),
      ]
      for (const arm of rotated) {
        const run = cold[arm]
        const detail = run ? freshRegion() : undefined
        gc?.()
        const t0 = performance.now()
        const n = run ? run(detail!) : arms[arm]!()
        const ms = performance.now() - t0
        if (r >= 2) {
          best[arm] = Math.min(best[arm] ?? Infinity, ms)
        }
        counts[arm] = n
      }
    }
    if (
      counts.encode === 0 ||
      counts.encode !== counts.control ||
      counts.encode !== counts.sum ||
      counts.encode !== counts.channels! + counts.insertions!
    ) {
      throw new Error(`broken fixture: encode emitted ${counts.encode}`)
    }
    const ms = (arm: string) => Math.round(best[arm]! * 100) / 100
    const row = {
      species,
      fetchedBp,
      binBp,
      blocks: features.length,
      columns: features.length * BLOCK_COLUMNS,
      cells: counts.channels,
      insertions: counts.insertions,
      placeMs: ms('place'),
      channelsMs: ms('channels'),
      insertionsMs: ms('insertions'),
      encodeMs: ms('encode'),
      controlMs: ms('control'),
      sumMs: ms('sum'),
    }
    results.push(row)
    if (!asJson) {
      console.log(JSON.stringify(row))
    }
  }
}
if (asJson) {
  console.log(JSON.stringify({ rounds, gc: Boolean(gc), results }, null, 2))
}
