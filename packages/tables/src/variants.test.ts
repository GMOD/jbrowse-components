import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { createTablesEngine } from './index.ts'
import { DOG_SV, DOG_VCF } from './volvox.fixture.ts'

const engine = createTablesEngine()

const without = <A extends { region: unknown }>({ region, ...rest }: A) => rest

/** Each table's rows, as one record per row, for comparing two calls. */
function rowsOf(table: Record<string, ArrayLike<unknown>>, drop: string[]) {
  const columns = Object.entries(table).filter(([name]) => !drop.includes(name))
  const n = columns[0]?.[1].length ?? 0
  return Array.from({ length: n }, (_, i) =>
    Object.fromEntries(columns.map(([name, c]) => [name, c[i]])),
  )
}

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
    if (called.length) {
      expect(d).toBeCloseTo(alt / called.length, 6)
    } else {
      expect(d).toBeNull()
    }
  })
  expect(t.cells.dosage[t.cells.genotype.indexOf('0/1')]).toBe(0.5)
  expect(t.cells.dosage[t.cells.genotype.indexOf('0/2')]).toBe(0.5)
  expect(t.cells.dosage[t.cells.genotype.indexOf('./.')]).toBeNull()
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
  t.cells.genotype.forEach((gt, i) => {
    const d = t.cells.dosage[i]
    const hp = t.rows.haplotype[t.rows.name.indexOf(t.cells.row[i]!)]!
    if (gt.includes('/') || gt.split('|')[hp] === '.') {
      expect(d).toBeNull()
    } else {
      expect(d).toBe(gt.split('|')[hp] === '0' ? 0 : 1)
    }
  })
})

test('the display’s filters drop records before any cell is painted', async () => {
  const all = await engine.variants(DOG_VCF)
  const common = await engine.variants({
    ...DOG_VCF,
    display: { filter: { minMinorAlleleFrequency: 0.3 } },
  })
  expect(common.variants.start.length).toBeGreaterThan(0)
  expect(common.variants.start.length).toBeLessThan(all.variants.start.length)
  const late = await engine.variants({
    ...DOG_VCF,
    display: { filter: ['jexl:feature.start > 38262000'] },
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

test('the rows take the arrangement `rows` saves: its order first, its labels, its focus', async () => {
  const plain = await engine.variants(DOG_VCF)
  const [a, b, c] = plain.rows.name.slice(-3) as [string, string, string]
  const t = await engine.variants({
    ...DOG_VCF,
    display: { rows: { domain: [c, a], labels: { [c]: 'Proband' } } },
  })
  expect(t.rows.name.slice(0, 2)).toEqual([c, a])
  expect(t.rows.name.slice(2)).toEqual(
    plain.rows.name.filter(n => n !== a && n !== c),
  )
  expect(t.rows.label[0]).toBe('Proband')
  expect(t.rows.label[1]).toBe(a)
  const focused = await engine.variants({
    ...DOG_VCF,
    display: { rows: { kept: [b, a] } },
  })
  expect([...focused.rows.name].sort()).toEqual([a, b].sort())
  expect(new Set(focused.cells.row)).toEqual(new Set([a, b]))
})

test('a sample named in the order places each of its haplotype rows', async () => {
  const plain = await engine.variants(DOG_VCF)
  const last = plain.rows.name.at(-1)!
  const t = await engine.variants({
    ...DOG_VCF,
    display: { unit: 'haplotype', rows: { domain: [last] } },
  })
  expect(t.rows.name.slice(0, 2)).toEqual([`${last} HP0`, `${last} HP1`])
  expect(t.rows.sample.slice(0, 2)).toEqual([last, last])
})

test('a facet stacks the rows in a band per value of the samples file’s attribute', async () => {
  const t = await engine.variants({
    ...DOG_SV,
    display: { facet: { field: 'group', domain: ['Gray wolf'] } },
  })
  expect(t.bands.label[0]).toBe('Gray wolf')
  expect(t.bands.label.slice(1)).toEqual([...t.bands.label.slice(1)].sort())
  expect(t.bands.start[0]).toBe(0)
  expect(t.bands.end.at(-1)).toBe(t.rows.name.length)
  t.bands.key.forEach((key, i) => {
    for (let r = t.bands.start[i]!; r < t.bands.end[i]!; r++) {
      expect(t.rows.band[r]).toBe(key)
    }
  })
  const plain = await engine.variants(DOG_SV)
  expect(plain.bands.key).toEqual([])
  expect(new Set(plain.rows.band)).toEqual(new Set(['']))
})

test('records crowding a pixel fade by their count, as a zoomed-out row draws them', async () => {
  const t = await engine.variants(DOG_VCF)
  const { start, end } = t.variants
  const near = engine.variantDensityAlpha({ start, end, bpPerPx: 0.1 })
  expect(new Set(near)).toEqual(new Set([1]))
  const far = engine.variantDensityAlpha({ start, end, bpPerPx: 50 })
  expect(Math.min(...far)).toBeLessThan(1)
  for (const a of far) {
    expect(a).toBeGreaterThan(0)
  }
  const long = engine.variantDensityAlpha({
    start: [0, 10, 11],
    end: [5000, 11, 12],
    bpPerPx: 64,
  })
  expect(long[0]).toBe(1)
  expect(long[1]).toBeCloseTo(1 - 0.1 ** 0.5, 5)
})

/**
 * `bcftools query -H -f '%POS\t%FILTER\t%INFO/AC\t%INFO/AN\t%INFO/POSITIVE_TRAIN_SITE\t%INFO/culprit\t%INFO/BaseQRankSum\n'`
 * over the whole file, which the region spans.
 */
const BCFTOOLS_QUERY = 'test_data/dog10k/dog10k_cyp1a2_snvs.bcftools_query.tsv'

test('each record carries its FILTER and INFO as bcftools query prints them', async () => {
  const t = await engine.variants(DOG_VCF)
  const query = readFileSync(path.resolve(BCFTOOLS_QUERY), 'utf8')
    .trim()
    .split('\n')
    .slice(1)
    .map(line => line.split('\t'))
  const missing = (v: string) => (v === '.' ? null : v)
  const joined = (v: unknown) =>
    Array.isArray(v) ? v.map(x => x ?? '.').join(',') : v
  expect(t.variants.start.map(s => `${s + 1}`)).toEqual(query.map(q => q[0]))
  expect(t.variants.filter).toEqual(query.map(q => missing(q[1]!)))
  expect(t.info.AC!.map(joined)).toEqual(query.map(q => q[2]))
  expect(t.info.AN).toEqual(query.map(q => Number(q[3])))
  expect(t.info.POSITIVE_TRAIN_SITE).toEqual(query.map(q => q[4] === '1'))
  expect(t.info.culprit).toEqual(query.map(q => missing(q[5]!)))
  expect(t.info.BaseQRankSum).toEqual(
    query.map(q => (q[6] === '.' ? null : Number(q[6]))),
  )
  expect(t.info.AC!.some(ac => (ac as number[]).length === 2)).toBe(true)
  expect(new Set(t.info.RAW_MQandDP)).toEqual(new Set([null]))
  const declared = (key: string) => {
    const i = t.infoFields.key.indexOf(key)
    return [t.infoFields.number[i], t.infoFields.type[i]]
  }
  expect(t.infoFields.key.slice(0, 3)).toEqual(['AC', 'AF', 'AN'])
  expect(declared('AC')).toEqual(['A', 'Integer'])
  expect(declared('NEGATIVE_TRAIN_SITE')).toEqual(['0', 'Flag'])
  expect(declared('culprit')).toEqual(['1', 'String'])
})

test('a record the display filters out takes its FILTER and INFO with it', async () => {
  const t = await engine.variants({
    ...DOG_VCF,
    display: { filter: ['jexl:get(feature,"FILTER") == "PASS"'] },
  })
  expect(t.variants.start.length).toBe(22)
  expect(new Set(t.variants.filter)).toEqual(new Set(['PASS']))
  for (const column of Object.values(t.info)) {
    expect(column).toHaveLength(22)
  }
})

const volvoxVcf = (file: string) =>
  pathToFileURL(path.resolve('test_data/volvox', file)).href

test('SnpEff’s ANN parses into a row per record and consequence, out of INFO', async () => {
  const args = {
    adapterConfig: {
      type: 'VcfTabixAdapter',
      vcfGzLocation: { uri: volvoxVcf('volvox.test.vcf.gz') },
      index: { location: { uri: volvoxVcf('volvox.test.vcf.gz.tbi') } },
    },
    region: { refName: 'contigA', start: 0, end: 50000 },
    bpPerPx: 50,
  }
  const t = await engine.features(args)
  const { annotations, annotationFields } = t.vcf!
  expect(annotationFields.field.slice(0, 4)).toEqual([
    'Allele',
    'Annotation',
    'Annotation_Impact',
    'Gene_Name',
  ])
  expect(annotationFields.field).toContain('AA.pos / AA.length')
  expect(new Set(annotationFields.key)).toEqual(new Set(['ANN']))
  expect(t.vcf!.info).not.toHaveProperty('ANN')
  expect(t.vcf!.infoFields.key).not.toContain('ANN')
  const first = t.features.start.indexOf(2999)
  const index = annotations.feature as number[]
  const rows = index.flatMap((f, i) => (f === first ? [i] : []))
  expect(rows.length).toBe(1)
  const at = (field: string) => annotations[field]![rows[0]!]
  expect(at('Annotation')).toBe('stop_gained')
  expect(at('Annotation_Impact')).toBe('HIGH')
  expect(at('Gene_Name')).toBe('GENEA')
  expect(at('AA.pos / AA.length')).toBeNull()
  for (const column of Object.values(annotations)) {
    expect(column).toHaveLength(index.length)
  }
})

test('VEP’s CSQ parses under its header’s Format list, one row a consequence', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'csq-'))
  const vcf = path.join(dir, 'vep.vcf')
  writeFileSync(
    vcf,
    [
      '##fileformat=VCFv4.2',
      '##INFO=<ID=CSQ,Number=.,Type=String,Description="Consequence annotations from Ensembl VEP. Format: Allele|Consequence|IMPACT|SYMBOL|Feature|DISTANCE">',
      '##INFO=<ID=DP,Number=1,Type=Integer,Description="Depth">',
      '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">',
      '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\ts1',
      'ctgA\t100\t.\tA\tG\t50\tPASS\tDP=9;CSQ=G|missense_variant|MODERATE|GENE1|T1|,G|upstream_gene_variant|MODIFIER|GENE2|T2|420\tGT\t0/1',
      'ctgA\t200\t.\tC\tT\t50\tPASS\tDP=4\tGT\t1/1',
    ].join('\n'),
  )
  const t = await engine.variants({
    adapterConfig: {
      type: 'VcfAdapter',
      vcfLocation: { uri: pathToFileURL(vcf).href },
    },
    region: { refName: 'ctgA', start: 0, end: 1000 },
  })
  expect(t.annotationFields.field).toEqual([
    'Allele',
    'Consequence',
    'IMPACT',
    'SYMBOL',
    'Feature',
    'DISTANCE',
  ])
  expect(t.annotations.variant).toEqual([0, 0])
  expect(t.annotations.Consequence).toEqual([
    'missense_variant',
    'upstream_gene_variant',
  ])
  expect(t.annotations.DISTANCE).toEqual([null, '420'])
  expect(t.annotations.key).toEqual(['CSQ', 'CSQ'])
  expect(Object.keys(t.info)).toEqual(['DP'])
})

test('variants: an empty first region still gives every row, and the second region’s cells', async () => {
  const one = await engine.variants(DOG_VCF)
  const t = await engine.variants({
    ...without(DOG_VCF),
    regions: [{ refName: 'chr30', start: 1000, end: 2000 }, DOG_VCF.region],
  })
  expect(t.rows).toEqual(one.rows)
  expect(t.bands).toEqual(one.bands)
  expect(new Set(t.variants.region)).toEqual(new Set([1]))
  expect(rowsOf(t.variants, ['region'])).toEqual(
    rowsOf(one.variants, ['region']),
  )
  expect(rowsOf(t.cells, ['region'])).toEqual(rowsOf(one.cells, ['region']))
  expect(new Set(t.cells.region)).toEqual(new Set([1]))
  expect(t.warnings).toEqual([])

  const listed = await engine.variants({
    ...without(DOG_VCF),
    regions: [DOG_VCF.region],
  })
  expect(listed).toEqual(one)
  expect(one.variants.key).toEqual(one.variants.start.map((_, i) => i))
})

test('a variant spanning two regions is listed in each under one key, and cells index the joined table', async () => {
  const one = await engine.variants(DOG_SV)
  const lengths = one.variants.start.map((s, i) => one.variants.end[i]! - s)
  const i = lengths.indexOf(Math.max(...lengths))
  const mid = Math.floor((one.variants.start[i]! + one.variants.end[i]!) / 2)
  const t = await engine.variants({
    ...without(DOG_SV),
    regions: [
      { ...DOG_SV.region, end: mid },
      { ...DOG_SV.region, start: mid },
    ],
  })
  const copies = t.variants.id
    .map((id, k) => k)
    .filter(k => t.variants.id[k] === one.variants.id[i])
  expect(copies).toHaveLength(2)
  expect(copies.map(k => t.variants.region[k])).toEqual([0, 1])
  expect(t.variants.key[copies[0]!]).toBe(t.variants.key[copies[1]!])
  expect(new Set(t.variants.key).size).toBe(one.variants.id.length)
  t.cells.variant.forEach((v, k) => {
    expect(t.variants.region[v]).toBe(t.cells.region[k])
  })
  const genotypes = (table: typeof t, v: number) =>
    table.cells.genotype.filter((_, k) => table.cells.variant[k] === v)
  for (const k of copies) {
    expect(genotypes(t, k)).toEqual(genotypes(one, i))
  }
  expect(t.rows).toEqual(one.rows)
})
