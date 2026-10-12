// The mark display's path over a multi-BigWig: the adapter's typed table, the
// facet on `source`, and the bar encode, each timed alone.
//
//   node --experimental-transform-types plugins/wiggle/benches/multiWiggleFacet.bench.ts
//
// Flags: --members (12), --rounds (15), --bpPerPx (1), --reversed.
//
// Members are named m0, m1, ... so the facet's natural order is the declared
// order, the case where the table already arrives in section order;
// --reversed declares them m11 first, so the facet has to reorder.
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'

import { layerTables } from '@jbrowse/core/util/featureTransforms'
import createJexlInstance from '@jbrowse/core/util/jexl'
import { encodeFeatures } from '@jbrowse/core/util/markEncoding'

import BigWigAdapter from '../src/BigWigAdapter/BigWigAdapter.ts'
import bigWigSchema from '../src/BigWigAdapter/configSchema.ts'
import MultiWiggleAdapter from '../src/MultiWiggleAdapter/MultiWiggleAdapter.ts'
import multiSchema from '../src/MultiWiggleAdapter/configSchema.ts'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const rounds = Number(flag('rounds') ?? 15)
const members = Number(flag('members') ?? 12)
const bpPerPx = Number(flag('bpPerPx') ?? 1)
const reversed = process.argv.includes('--reversed')
const files = [
  'volvox_microarray.bw',
  'volvox-sorted.bam.coverage.bw',
  'v1.cram.bw',
  'v2.cram.bw',
  'v3.cram.bw',
  'v4.cram.bw',
].map(f => resolve('test_data/volvox', f))

const jexl = createJexlInstance()
const adapter = new MultiWiggleAdapter(
  multiSchema.create({
    subadapters: Array.from({ length: members }, (_, i) => ({
      type: 'BigWigAdapter',
      source: `m${reversed ? members - 1 - i : i}`,
      bigWigLocation: {
        localPath: files[i % files.length],
        locationType: 'LocalPathLocation',
      },
    })),
  }),
  (async (conf: Record<string, unknown>) => ({
    dataAdapter: new BigWigAdapter(bigWigSchema.create(conf)),
  })) as never,
  { jexl, getAdapterType: () => ({ configSchema: bigWigSchema }) } as never,
)
const region = { refName: 'ctgA', start: 0, end: 50_000, assemblyName: 'v' }
const table = await adapter.getFeatureTable(region, { bpPerPx })

const facet = () =>
  layerTables(table, { facet: { field: 'source' }, layers: [{}] }, jexl)
const faceted = facet().layers[0]!
const encode = () =>
  encodeFeatures(
    faceted.table,
    { y: 'score', row: faceted.row, color: 'red' },
    ['y', 'row', 'color'],
    { jexl },
  )

const arms: [string, () => unknown][] = [
  ['facet', facet],
  ['encode (faceted table)', encode],
  [
    'encode (table as fetched)',
    () =>
      encodeFeatures(
        table,
        { y: 'score', row: faceted.row, color: 'red' },
        ['y', 'row', 'color'],
        { jexl },
      ),
  ],
  [
    'facet + encode',
    () => {
      const f = facet().layers[0]!
      return encodeFeatures(
        f.table,
        { y: 'score', row: f.row, color: 'red' },
        ['y', 'row', 'color'],
        { jexl },
      )
    },
  ],
]
const best = new Map<string, number>()
for (let r = 0; r < rounds; r++) {
  for (let k = 0; k < arms.length; k++) {
    const [name, run] = arms[(k + r) % arms.length]!
    const t0 = performance.now()
    run()
    const ms = performance.now() - t0
    if (r > 0) {
      best.set(name, Math.min(best.get(name) ?? Infinity, ms))
    }
  }
}
console.log(`bpPerPx ${bpPerPx}, ${members} members, ${table.length} rows`)
for (const [name] of arms) {
  console.log(
    `  ${name.padEnd(24)} ${best.get(name)!.toFixed(2).padStart(8)}ms`,
  )
}
