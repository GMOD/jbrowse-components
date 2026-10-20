import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { createTablesEngine } from './index.ts'
import { ALL_VS_ALL, GENE_BLOCKS, STAR, SYRI } from './synteny.fixture.ts'

const engine = createTablesEngine()

function columnsAgree(table: Record<string, unknown[]>) {
  expect(new Set(Object.values(table).map(c => c.length)).size).toBe(1)
}

function rowsOf<T extends Record<string, unknown[]>>(
  table: T,
  where: number[],
) {
  return where.map(i =>
    Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v[i]])),
  )
}

const column = (table: object, name: string) =>
  (table as Record<string, unknown[]>)[name]!

const indexes = (values: unknown[], test: (v: unknown) => boolean) =>
  values.flatMap((v, i) => (test(v) ? [i] : []))

test('an all-vs-all PAF stacks a lane per genome, with ribbons down each gutter', async () => {
  const t = await engine.multiway(ALL_VS_ALL)
  for (const table of [t.lanes, t.segments, t.blocks, t.ribbons]) {
    columnsAgree(table)
  }
  columnsAgree(t.alignments)
  expect(t.assemblyNames).toEqual(['volvox', 'volvox_ins', 'volvox_del'])
  expect(t.lanes.anchor).toEqual([true, false, false])
  expect(t.lanes.chrom).toEqual(['ctgA', 'ctgA', 'ctgA'])
  expect(t.lanes.flipped).toEqual([false, false, false])
  expect(t.rowsVsAnchor).toBe(false)
  expect(t.tickInterval).toBe(10_000)
  expect(t.segments.start[0]).toBe(0)
  expect(t.segments.end[0]).toBe(50_001)
  expect(t.segments.x2[0]).toBe(800)

  expect(new Set(t.ribbons.gutter)).toEqual(new Set([0, 1]))
  for (let i = 0; i < t.ribbons.gutter.length; i++) {
    expect(t.ribbons.upperLane[i]).toBe(t.ribbons.gutter[i])
    expect(t.ribbons.lowerLane[i]).toBe(t.ribbons.gutter[i]! + 1)
  }
  const first = rowsOf(
    t.ribbons,
    indexes(t.ribbons.gutter, g => g === 0),
  )
  expect(first.map(r => [r.upperStart, r.upperEnd])).toEqual([
    [0, 31_198],
    [31_198, 50_001],
  ])
  expect(first.map(r => [r.lowerStart, r.lowerEnd])).toEqual([
    [0, 31_198],
    [35_998, 54_801],
  ])
  const second = rowsOf(
    t.ribbons,
    indexes(t.ribbons.gutter, g => g === 1),
  )
  expect(second.map(r => [r.upperStart, r.upperEnd])).toEqual([
    [0, 28_498],
    [38_158, 54_801],
  ])
  expect(second.map(r => r.lowerChrom)).toEqual(['ctgA', 'ctgA'])
  expect(new Set(t.ribbons.color)).toEqual(new Set(['#ff6347']))
  expect(t.ribbons.alpha[0]).toBeCloseTo(0.3, 2)

  const linked =
    t.ribbons.alignment[indexes(t.ribbons.gutter, g => g === 1)[0]!]!
  expect(t.alignments.assembly[linked]).toBe('volvox_ins')
  expect(t.alignments.mateAssembly[linked]).toBe('volvox_del')
  expect(column(t.alignments, 'identity')[linked]).toBe(1)
  expect(t.legend.label).toEqual([
    'Same orientation as lane above',
    'Inverted vs lane above',
  ])
})

test('the rows slot orders the lanes and keeps the ones it names', async () => {
  const swapped = await engine.multiway({
    ...ALL_VS_ALL,
    display: { rows: { domain: ['volvox_del'] } },
  })
  expect(swapped.assemblyNames).toEqual(['volvox', 'volvox_del', 'volvox_ins'])
  const kept = await engine.multiway({
    ...ALL_VS_ALL,
    display: { rows: { kept: ['volvox_del'] } },
  })
  expect(kept.assemblyNames).toEqual(['volvox', 'volvox_del'])
  expect(new Set(kept.ribbons.gutter)).toEqual(new Set([0]))
})

test('ribbons color by strand, keyed against the lane above', async () => {
  const t = await engine.multiway({
    ...ALL_VS_ALL,
    display: { ribbonColor: { field: 'strand' }, drawCurves: true },
  })
  expect(t.config).toMatchObject({
    drawCurves: true,
    hideUnlabelled: false,
    ribbonColor: { field: 'strand' },
  })
  expect(t.legend.label).toEqual([
    'Same orientation as lane above',
    'Inverted vs lane above',
  ])
  expect(new Set(t.ribbons.color)).toEqual(new Set([t.legend.color[0]]))
})

test('SyRI calls color their ribbons, and a lane unaligned on both sides opens no hole', async () => {
  const t = await engine.multiway(SYRI)
  expect(t.assemblyNames).toEqual(['Col-0', 'Ler', 'Cvi', 'Eri', 'Kyo', 'Sha'])
  expect(t.legend.label).toEqual(['SYN', 'INV', 'TRANS, INVTR', 'DUP, INVDP'])
  const syri = t.ribbons.alignment.map(a => column(t.alignments, 'syri')[a])
  const inverted = indexes(syri, s => s === 'INV')
  expect(inverted.length).toBeGreaterThan(0)
  expect(new Set(inverted.map(i => t.ribbons.color[i]))).toEqual(
    new Set(['#ffa500']),
  )
  for (const i of inverted) {
    expect(
      Math.sign(t.ribbons.upperEnd[i]! - t.ribbons.upperStart[i]!),
    ).not.toBe(Math.sign(t.ribbons.lowerEnd[i]! - t.ribbons.lowerStart[i]!))
  }
  // Cvi's one hole is 30.6 kb of Col-0 against 12.6 kb of its own sequence;
  // its centromere, 216 kb of its own against 280 kb, outweighs no deletion
  const cvi = indexes(t.segments.lane, l => l === 2)
  expect(cvi).toHaveLength(2)
  expect(t.segments.end[cvi[0]!]).toBe(15_426_914)
  expect(t.segments.start[cvi[1]!]).toBe(15_426_914)

  const pinned = await engine.multiway({
    ...SYRI,
    pins: { Cvi: { refName: 'Chr2' } },
  })
  expect(pinned.lanes.chrom[2]).toBe('Chr2')
  expect(t.lanes.chrom[2]).toBe('Chr1')
})

test('a gene table joins a gene across a lane that lacks it', async () => {
  const t = await engine.multiway({
    ...GENE_BLOCKS,
    display: { ribbonColor: { field: 'strand' } },
  })
  expect(t.lanes.chrom).toEqual(['chr1', 'Pp1', 'Tc1'])
  expect(t.blocks.name.filter((_, i) => t.blocks.lane[i] === 1)).toEqual([
    'p1',
    'p2',
    'p4',
  ])
  const bridged = indexes(t.ribbons.bridge, b => b === true)
  expect(bridged.map(i => t.ribbons.group[i])).toEqual(['g3'])
  expect(t.ribbons.lowerLane[bridged[0]!]).toBe(2)
  expect(t.ribbons.alpha[bridged[0]!]).toBeLessThan(t.ribbons.alpha[0]!)
  const g2 = t.ribbons.group.indexOf('g2')
  expect(t.ribbons.color[g2]).toBe(t.legend.color[1])

  const unbridged = await engine.multiway({
    ...GENE_BLOCKS,
    display: { bridgeSkippedLanes: false },
  })
  expect(unbridged.ribbons.bridge).not.toContain(true)
})

test('a star of pairwise files draws each lane against the anchor', async () => {
  const t = await engine.multiway(STAR)
  expect(t.rowsVsAnchor).toBe(true)
  expect(t.assemblyNames).toEqual(['volvox', 'volvox_ins', 'volvox_del'])
  expect(new Set(t.ribbons.upperLane)).toEqual(new Set([0]))
  expect(new Set(t.ribbons.gutter)).toEqual(new Set([0, 1]))
})

test('a lane reading backwards against the anchor flips, and its ribbons run straight', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'multiway-'))
  const file = path.join(dir, 'flip.paf')
  const row = (i: number, strand: string, mate: string, from: number) =>
    [
      'A#1#chr1',
      10_000,
      i * 2000,
      i * 2000 + 1000,
      strand,
      `${mate}#1#chr1`,
      10_000,
      from,
      from + 1000,
      1000,
      1000,
      60,
      'cg:Z:1000M',
    ].join('\t')
  writeFileSync(
    file,
    [0, 1, 2, 3, 4].map(i => row(i, '-', 'B', 9000 - i * 2000)).join('\n'),
  )
  const t = await engine.multiway({
    adapterConfig: {
      type: 'MultiGenomePAFAdapter',
      pafLocation: {
        uri: pathToFileURL(file).href,
        locationType: 'UriLocation',
      },
    },
    anchor: {
      assemblyName: 'A',
      regions: [{ refName: 'chr1', start: 0, end: 10_000 }],
      width: 800,
    },
    display: { ribbonColor: { field: 'strand' }, rows: { domain: ['B'] } },
  })
  expect(t.assemblyNames).toEqual(['A', 'B'])
  expect(t.lanes.flipped).toEqual([false, true])
  expect([t.segments.x1[1], t.segments.x2[1]]).toEqual([800, 0])
  expect(t.ribbons.upperX1).toEqual(t.ribbons.lowerX1)
  expect(new Set(t.ribbons.color)).toEqual(new Set([t.legend.color[1]]))
  expect(new Set(t.ribbons.gutter)).toEqual(new Set([0]))
})
