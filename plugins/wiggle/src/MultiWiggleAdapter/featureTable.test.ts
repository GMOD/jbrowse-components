import path from 'node:path'

import PluginManager from '@jbrowse/core/PluginManager'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { SimpleFeature } from '@jbrowse/core/util'
import BedPlugin from '@jbrowse/plugin-bed'
import { of } from 'rxjs'

import WigglePlugin from '../index.ts'
import MultiWiggleAdapter from './MultiWiggleAdapter.ts'
import configSchema from './configSchema.ts'

import type { RawFeatureArrays } from '../util.ts'
import type { FeatureTable } from '@jbrowse/core/util/featureTable'

const volvox = path.resolve(__dirname, '../../../../test_data/volvox')
const hub = path.resolve(__dirname, '../../../../test_data/volvoxhub/bbi')

function bigWig(localPath: string, extra: Record<string, unknown> = {}) {
  return {
    type: 'BigWigAdapter',
    bigWigLocation: { localPath, locationType: 'LocalPathLocation' },
    ...extra,
  }
}

async function stackOf(subadapters: Record<string, unknown>[]) {
  const pm = new PluginManager([new BedPlugin(), new WigglePlugin()])
  pm.createPluggableElements()
  pm.configure()
  const { dataAdapter } = await getAdapter(pm, 'test', {
    type: 'MultiWiggleAdapter',
    subadapters,
  })
  return dataAdapter as MultiWiggleAdapter
}

const region = { refName: 'ctgA', start: 0, end: 40_000, assemblyName: 'v' }

function sourceLabels(table: FeatureTable) {
  const column = table.column('source')
  return column.kind === 'category' ? column.labels : undefined
}

describe('MultiWiggleAdapter.getFeatureTable over BigWigs', () => {
  const members = [
    bigWig(`${volvox}/volvox_microarray.bw`, { name: 'micro' }),
    bigWig(`${volvox}/volvox-sorted.bam.coverage.bw`),
    bigWig(`${hub}/volvox-sorted.bam.coverage.bw`),
  ]

  it.each([
    ['raw records', 1, 2000, false],
    ['a summary tier', 1000, 40_000, true],
  ])(
    'answers a table whose rows are its features, over %s',
    async (_, bpPerPx, end, summary) => {
      const adapter = await stackOf(members)
      const o = { bpPerPx, resolution: 1 }
      const span = { ...region, end }
      const features = await adapter.getFeaturesArray(span, o)
      const table = await adapter.getFeatureTable(span, o)
      expect(features.some(f => f.get('summary'))).toBe(summary)
      expect(sourceLabels(table)).toEqual([
        'micro',
        'volvox/volvox-sorted.bam.coverage',
        'bbi/volvox-sorted.bam.coverage',
      ])
      expect(new Set(features.map(f => f.get('source'))).size).toBe(3)
      expect(table.length).toBe(features.length)
      features.forEach((f, i) => {
        const row = table.row(i)
        expect(row.id()).toBe(f.id())
        expect(row.toJSON()).toEqual(f.toJSON())
        for (const field of [
          'start',
          'end',
          'score',
          'minScore',
          'maxScore',
          'summary',
        ]) {
          expect(row.get(field)).toBe(f.get(field))
        }
        expect(row.get('maxScore')).toEqual(expect.any(Number))
      })
    },
  )

  it('reads only the subtracks a caller names', async () => {
    const adapter = await stackOf(members)
    const table = await adapter.getFeatureTable(region, {
      sources: [{ name: 'micro' }],
    })
    expect(sourceLabels(table)).toEqual(['micro'])
    expect(table.length).toBeGreaterThan(0)
  })

  it("answers a BigBed member's own fields through its features", async () => {
    const adapter = await stackOf([
      bigWig(`${volvox}/volvox_microarray.bw`),
      {
        type: 'BigBedAdapter',
        bigBedLocation: {
          localPath: `${volvox}/volvox.bb`,
          locationType: 'LocalPathLocation',
        },
      },
    ])
    const table = await adapter.getFeatureTable(region)
    expect(table.column('source').kind).toBe('feature')
    const rows = Array.from({ length: table.length }, (_, i) => table.row(i))
    const bed = rows.find(row => row.get('source') === 'volvox')!
    expect(bed.get('name')).toBeDefined()
  })
})

describe('MultiWiggleAdapter.getFeatureTable over arrays', () => {
  function raw(
    starts: number[],
    scores: number[],
    summary?: { min: number[]; max: number[] },
  ): RawFeatureArrays {
    return {
      starts: Int32Array.from(starts),
      ends: Int32Array.from(starts, s => s + 10),
      scores: Float32Array.from(scores),
      minScores: summary && Float32Array.from(summary.min),
      maxScores: summary && Float32Array.from(summary.max),
      count: starts.length,
    }
  }

  function adapterOver(members: Record<string, object>) {
    return new MultiWiggleAdapter(
      configSchema.create({
        subadapters: Object.keys(members).map(source => ({
          type: 'BigWigAdapter',
          source,
          bigWigLocation: { uri: `${source}.bw` },
        })),
      }),
      jest.fn().mockImplementation(async (conf: { source: string }) => ({
        dataAdapter: { id: conf.source, ...members[conf.source] },
      })),
    )
  }

  const chr1 = { refName: 'chr1', start: 0, end: 100, assemblyName: 'a' }

  it('codes each row by its subtrack, in declared order', async () => {
    const adapter = adapterOver({
      b: { getFeatureArrays: async () => [raw([0, 10], [1, 2])] },
      a: { getFeatureArrays: async () => [raw([5], [3])] },
    })
    const table = await adapter.getFeatureTable(chr1)
    const column = table.column('source')
    expect(column.kind).toBe('category')
    if (column.kind === 'category') {
      expect(column.labels).toEqual(['b', 'a'])
      expect([...column.codes]).toEqual([0, 0, 1])
    }
    const rows = [0, 1, 2].map(i => table.row(i))
    expect(rows.map(r => [r.get('start'), r.get('score')])).toEqual([
      [0, 1],
      [10, 2],
      [5, 3],
    ])
    expect(rows.map(r => r.id())).toEqual([
      'b:chr1:0-10',
      'b:chr1:10-20',
      'a:chr1:5-15',
    ])
  })

  it('answers a raw subtrack row its score as min and max', async () => {
    const adapter = adapterOver({
      raw: { getFeatureArrays: async () => [raw([0], [1])] },
      binned: {
        getFeatureArrays: async () => [raw([0], [5], { min: [2], max: [9] })],
      },
    })
    const table = await adapter.getFeatureTable(chr1)
    const [plain, summary] = [table.row(0), table.row(1)]
    expect(plain.get('summary')).toBe(false)
    expect(plain.get('minScore')).toBe(1)
    expect(plain.get('maxScore')).toBe(1)
    expect(summary.get('summary')).toBe(true)
    expect(summary.get('minScore')).toBe(2)
    expect(summary.get('maxScore')).toBe(9)
  })

  it('reads features where a subtrack serves no arrays', async () => {
    const feature = (fields: Record<string, unknown>) => () =>
      of(
        new SimpleFeature({
          uniqueId: 'f',
          refName: 'chr1',
          start: 0,
          end: 10,
          ...fields,
        }),
      )
    const adapter = adapterOver({
      arrays: {
        getFeatureArrays: async () => [raw([0], [1])],
        getFeatures: feature({ score: 1 }),
      },
      features: { getFeatures: feature({ score: 4, methylated: 7 }) },
    })
    const table = await adapter.getFeatureTable(chr1)
    expect(table.column('source').kind).toBe('feature')
    expect(table.row(1).get('methylated')).toBe(7)
  })
})
