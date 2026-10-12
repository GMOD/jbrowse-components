import { readFileSync } from 'node:fs'
import path from 'node:path'

import { createTablesEngine } from './index.ts'
import { DOG_SV, DOG_VCF } from './volvox.fixture.ts'

const engine = createTablesEngine()

test('a multi-sample VCF comes back as the display paints its genotypes', async () => {
  const t = await engine.variants(DOG_VCF)
  const n = t.variants.start.length
  expect(n).toBe(490)
  expect(t.rows.name).toHaveLength(39)
  for (const table of [t.variants, t.cells, t.rows, t.legend]) {
    expect(new Set(Object.values(table).map(c => c.length)).size).toBe(1)
  }
  expect(t.cells.genotype).not.toContain('0/0')
  const colorOf = new Map<string, Set<string>>()
  t.cells.genotype.forEach((gt, i) => {
    const set = colorOf.get(gt) ?? new Set()
    set.add(t.cells.color[i]!)
    colorOf.set(gt, set)
  })
  const [het] = colorOf.get('0/1')!
  const [hom] = colorOf.get('1/1')!
  expect(colorOf.get('0/1')!.size).toBe(1)
  expect(colorOf.get('1/1')!.size).toBe(1)
  expect(het).not.toBe(hom)
  expect(hom).toBe(t.variants.color[0])
  t.cells.dosage.forEach((d, i) => {
    const called = t.cells.genotype[i]!.split(/[/|]/).filter(a => a !== '.')
    const alt = called.filter(a => a !== '0').length
    expect(d).toBeCloseTo(called.length ? alt / called.length : 0, 1)
  })
  for (const color of new Set(t.cells.color)) {
    expect(t.legend.color).toContain(color)
  }
})

test('drawing reference calls fills the grid, one cell a sample a site', async () => {
  const t = await engine.variants({
    ...DOG_VCF,
    display: { referenceDrawingMode: 'draw' },
  })
  expect(t.cells.variant.length).toBe(490 * 39)
  const ref = t.cells.color.filter((_, i) => t.cells.dosage[i] === 0)
  expect(new Set(ref).size).toBeGreaterThan(0)
})

test('haplotype rows split each sample, and an unphased call paints as unphased', async () => {
  const t = await engine.variants({
    ...DOG_VCF,
    display: { unit: 'haplotype' },
  })
  expect(t.rows.name).toHaveLength(78)
  expect(new Set(t.rows.sample).size).toBe(39)
  expect(new Set(t.rows.haplotype)).toEqual(new Set([0, 1]))
  const unphased = t.cells.color.filter((_, i) =>
    t.cells.genotype[i]!.includes('/'),
  )
  expect(new Set(unphased).size).toBe(2)
  expect(t.legend.label.some(l => /unphased/i.test(l))).toBe(true)
})

test('the display’s filters drop records before any cell is painted', async () => {
  const all = await engine.variants(DOG_VCF)
  const common = await engine.variants({
    ...DOG_VCF,
    display: { minorAlleleFrequencyFilter: 0.3 },
  })
  expect(common.variants.start.length).toBeGreaterThan(0)
  expect(common.variants.start.length).toBeLessThan(all.variants.start.length)
  const late = await engine.variants({
    ...DOG_VCF,
    display: { filter: ['jexl:get(feature,"start") > 38262000'] },
  })
  expect(Math.min(...late.variants.start)).toBeGreaterThan(38262000)
})

test('each row takes the display’s rowColor from the samples file, under the attribute’s key', async () => {
  const t = await engine.variants({
    ...DOG_SV,
    display: { rowColor: { field: 'group' } },
  })
  const groupOf = new Map(
    readFileSync(
      path.resolve('test_data/dog10k/dog10k_amy2b_samples.tsv'),
      'utf8',
    )
      .trim()
      .split('\n')
      .slice(1)
      .map(line => line.split('\t') as [string, string]),
  )
  expect(t.rowLegendTitle).toBe('Group')
  expect([...t.rowLegend.label].sort()).toEqual([
    'Breed dog',
    'Gray wolf',
    'Village dog',
  ])
  const keyed = new Map(
    t.rowLegend.label.map((l, i) => [l, t.rowLegend.color[i]]),
  )
  t.rows.name.forEach((name, i) => {
    expect(t.rows.color[i]).toBe(keyed.get(groupOf.get(name)!))
  })
  const plain = await engine.variants(DOG_SV)
  expect(new Set(plain.rows.color)).toEqual(new Set(['']))
  expect(plain.rowLegend.label).toEqual([])
})
