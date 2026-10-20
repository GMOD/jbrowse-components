import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { registerAlignmentsAdapters } from '@jbrowse/plugin-alignments/tables'
import { registerSequenceAdapters } from '@jbrowse/plugin-sequence/adapters'

import { executeRenderAlignmentData } from '../../../plugins/alignments/src/RenderAlignmentDataRPC/executeRenderAlignmentData.ts'
import { buildLaidOutPileupMap } from '../../../plugins/alignments/src/RenderAlignmentDataRPC/sortLayout.ts'
import { createTablesEngine } from './index.ts'
import {
  BAM,
  PAIRED_INVERSION,
  READ_GROUPS,
  SPLICED,
  WGSIM,
} from './volvox.fixture.ts'

const engine = createTablesEngine()

const without = <A extends { region: unknown }>({ region, ...rest }: A) => rest

test('regions: [region] reads as region, every row in region 0', async () => {
  const one = await engine.alignments(BAM)
  const listed = await engine.alignments({
    ...without(BAM),
    regions: [BAM.region],
  })
  expect(listed).toEqual(one)
  for (const name of [
    'reads',
    'mismatches',
    'gaps',
    'coverage',
    'alleleCoverage',
  ] as const) {
    expect(new Set(one[name].region)).toEqual(new Set([0]))
  }
  expect(one.reads.key).toEqual(one.reads.start.map((_, i) => i))
  expect(one.junctions).not.toHaveProperty('region')
  expect(one.warnings).toEqual([])
})

test('a read crossing a seam is listed in both regions under one key, on one row', async () => {
  const regions = [
    { refName: 'ctgA', start: 1000, end: 3000 },
    { refName: 'ctgA', start: 3000, end: 6000 },
  ]
  const { reads, coverage } = await engine.alignments({
    ...without(BAM),
    regions,
  })
  const copies = new Map<number, number[]>()
  reads.key.forEach((key, i) => {
    copies.set(key, [...(copies.get(key) ?? []), i])
  })
  expect([...copies.keys()].sort((a, b) => a - b)).toEqual(
    [...copies.keys()].map((_, i) => i),
  )
  const crossing = [...copies.values()].filter(c => c.length > 1)
  expect(crossing.length).toBeGreaterThan(10)
  for (const [a, b] of crossing) {
    expect(reads.region[a!]).toBe(0)
    expect(reads.region[b!]).toBe(1)
    expect(reads.id[a!]).toBe(reads.id[b!])
    expect(reads.row[a!]).toBe(reads.row[b!])
    expect(reads.start[a!]).toBeLessThan(3000)
    expect(reads.end[a!]).toBeGreaterThan(3000)
  }
  coverage.start.forEach((start, i) => {
    const r = regions[coverage.region[i]!]!
    expect(start).toBeGreaterThanOrEqual(r.start)
    expect(coverage.end[i]).toBeLessThanOrEqual(r.end)
  })

  // the rows are the display's own multi-region layout over the same reads
  class Adapters extends Plugin {
    name = 'Adapters'
    install(pm: PluginManager) {
      registerAlignmentsAdapters(pm)
      registerSequenceAdapters(pm)
    }
  }
  const pluginManager = new PluginManager([new Adapters()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const data = await Promise.all(
    regions.map(async r => {
      const result = await executeRenderAlignmentData({
        pluginManager,
        args: {
          sessionId: 'tables',
          adapterConfig: BAM.adapterConfig,
          sequenceAdapter: BAM.sequenceAdapter,
          regions: [{ assemblyName: '', ...r }],
          colorBy: { type: 'normal' },
          statusCallback: () => {},
        },
      })
      if ('regionTooLarge' in result) {
        throw new Error('too large')
      }
      return result.value.groups[0]!.data
    }),
  )
  const laid = buildLaidOutPileupMap({
    dataMap: new Map(data.map((d, i) => [i, d])),
    sortColumn: undefined,
    showSoftClipping: false,
    regions: new Map(regions.map((r, i) => [i, r])),
  })
  regions.forEach((_, i) => {
    expect(reads.row.filter((_, j) => reads.region[j] === i)).toEqual(
      Array.from(laid.get(i)!.readYs),
    )
  })
})

test('regions on two contigs lay out on their own, and a base sort across them warns', async () => {
  const regions = [
    { refName: 'ctgA', start: 1000, end: 2000 },
    { refName: 'ctgB', start: 1000, end: 2000 },
  ]
  const both = await engine.alignments({ ...without(WGSIM), regions })
  const alone = await Promise.all(
    regions.map(region => engine.alignments({ ...WGSIM, region })),
  )
  regions.forEach((_, i) => {
    expect(both.reads.row.filter((_, j) => both.reads.region[j] === i)).toEqual(
      alone[i]!.reads.row,
    )
  })
  expect(new Set(both.reads.key).size).toBe(both.reads.key.length)

  const sort = { field: 'base', pos: 1500, refName: 'ctgA' }
  const sorted = await engine.alignments({
    ...without(WGSIM),
    regions,
    display: { sort },
  })
  expect(sorted.warnings).toEqual([
    'the sort by base at ctgA:1500 is dropped: the regions with reads span several contigs (ctgA, ctgB), so the reads lay out by position',
  ])
  expect(sorted.reads.row).toEqual(both.reads.row)
  const one = await engine.alignments({
    ...WGSIM,
    region: regions[0]!,
    display: { sort },
  })
  expect(one.warnings).toEqual([])
})

test('a sort no region with reads holds warns', async () => {
  const t = await engine.alignments({
    ...without(BAM),
    regions: [
      { refName: 'ctgA', start: 1000, end: 2000 },
      { refName: 'ctgA', start: 3000, end: 4000 },
    ],
    display: { sort: { field: 'base', pos: 2500 } },
  })
  expect(t.warnings).toEqual([
    'the sort by base at ctgA:2500 is dropped: no region with reads holds position 2500, so the reads lay out by position',
  ])
})

test('a junction two regions show is listed once, naming the region at each foot', async () => {
  const one = await engine.alignments(SPLICED)
  const { junctions: j } = one
  const inside = j.start
    .map((_, k) => k)
    .filter(
      k => j.start[k]! > SPLICED.region.start && j.end[k]! < SPLICED.region.end,
    )
  const i = inside.reduce((best, k) =>
    j.count[k]! > j.count[best]! ? k : best,
  )
  const start = j.start[i]!
  const end = j.end[i]!
  const mid = Math.floor((start + end) / 2)
  const { junctions } = await engine.alignments({
    ...without(SPLICED),
    regions: [
      { ...SPLICED.region, end: mid },
      { ...SPLICED.region, start: mid },
    ],
  })
  const at = junctions.start
    .map((s, k) => k)
    .filter(k => junctions.start[k] === start && junctions.end[k] === end)
  expect(at).toHaveLength(1)
  const k = at[0]!
  expect(junctions.count[k]).toBe(j.count[i])
  expect(junctions.startRegion[k]).toBe(0)
  expect(junctions.endRegion[k]).toBe(1)
  expect(junctions.refName[k]).toBe('ctgA')
  expect(one.junctions.startRegion[i]).toBe(0)
  expect(one.junctions.endRegion[i]).toBe(0)
})

test('an arc whose feet two regions hold is listed once, naming both', async () => {
  const display = { readConnections: { show: true } }
  const one = await engine.alignments({ ...PAIRED_INVERSION, display })
  const t = await engine.alignments({
    ...without(PAIRED_INVERSION),
    regions: [
      { refName: 'ctgA', start: 18000, end: 25000 },
      { refName: 'ctgA', start: 25000, end: 32000 },
    ],
    display,
  })
  const arcsOf = (a: typeof t.arcs) =>
    a.start.map((s, i) => `${s} ${a.end[i]} ${a.support[i]}`).sort()
  expect(arcsOf(t.arcs)).toEqual(arcsOf(one.arcs))
  const crossing = t.arcs.start
    .map((_, i) => i)
    .filter(
      i =>
        t.arcs.startRegion[i]! >= 0 &&
        t.arcs.endRegion[i]! >= 0 &&
        t.arcs.startRegion[i] !== t.arcs.endRegion[i],
    )
  expect(crossing.length).toBeGreaterThan(0)
  for (const i of crossing) {
    expect(t.arcs.region[i]).toBe(t.arcs.startRegion[i])
  }
  expect(new Set(one.arcs.region)).toEqual(new Set([0]))
})

test('a chain across two regions keeps one row, and a sort under it warns', async () => {
  const t = await engine.alignments({
    ...without(PAIRED_INVERSION),
    regions: [
      { refName: 'ctgA', start: 18000, end: 25000 },
      { refName: 'ctgA', start: 25000, end: 32000 },
    ],
    display: { unit: 'chain', sort: { field: 'length' } },
  })
  const rows = new Map<string, Set<number>>()
  t.reads.name.forEach((name, i) => {
    rows.set(name, (rows.get(name) ?? new Set()).add(t.reads.row[i]!))
  })
  expect([...rows.values()].every(r => r.size === 1)).toBe(true)
  expect(new Set(t.reads.region)).toEqual(new Set([0, 1]))
  expect(new Set(t.chains.region)).toEqual(new Set([0, 1]))
  expect(t.warnings).toEqual([
    "under unit 'chain' the reads lay out by chain, so the sort by length is dropped",
  ])
})

test('sections are every region’s: a value only the second region holds has its own', async () => {
  const regions = [
    { refName: 'ctgA', start: 0, end: 50 },
    { refName: 'ctgA', start: 1000, end: 1100 },
  ]
  const display = { facet: { field: 'tags.RG' } }
  const first = await engine.alignments({
    ...READ_GROUPS,
    region: regions[0]!,
    display,
  })
  expect(first.sections.key).toEqual(['4'])
  const t = await engine.alignments({
    ...without(READ_GROUPS),
    regions,
    display,
  })
  expect([...t.sections.key].sort()).toEqual(['4', '5'])
  const label5 = t.sections.label[t.sections.key.indexOf('5')]!
  const regionsOf5 = new Set(
    t.reads.region.filter((_, i) => t.reads.section[i] === label5),
  )
  expect(regionsOf5).toEqual(new Set([1]))
})

test('the limits hold over the regions together', async () => {
  const regions = [
    { refName: 'ctgA', start: 1000, end: 4000 },
    { refName: 'ctgA', start: 10000, end: 13000 },
  ]
  await expect(
    engine.alignments({ ...BAM, region: regions[0]!, spanLimit: 5000 }),
  ).resolves.toBeDefined()
  await expect(
    engine.alignments({ ...without(BAM), regions, spanLimit: 5000 }),
  ).rejects.toThrow(
    'ctgA:1000-4000, ctgA:10000-13000 span 6000 bp of alignments in total, over the 5000-bp limit',
  )

  const bytesOf = async (region: (typeof regions)[number]) => {
    const error = await engine
      .alignments({ ...BAM, region, byteLimit: 1 })
      .catch((e: unknown) => e as Error)
    return Number(/needs (\d+) bytes/.exec(String(error))![1])
  }
  const [a, b] = await Promise.all(regions.map(bytesOf))
  const byteLimit = Math.max(a!, b!)
  await expect(
    engine.alignments({ ...without(BAM), regions, byteLimit }),
  ).rejects.toThrow(
    `need ${a! + b!} bytes of alignments in total, over the ${byteLimit}-byte limit`,
  )
})
