import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import { cssColorToHex } from '@jbrowse/core/util/colorBits'

import { DEFAULT_VARIANT_DISPLAY_HEIGHT } from '../../../plugins/variants/src/LinearVariantDisplay/configSchema.ts'
import { REFERENCE_COLOR } from '../../../plugins/variants/src/shared/constants.ts'
import { createTablesEngine } from './index.ts'
import { DOG_SV, DOG_VCF } from './volvox.fixture.ts'

const engine = createTablesEngine()

const GOLDENROD = cssColorToHex(featureDefaultColor)

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
  expect(new Set(t.variants.color)).toEqual(new Set([GOLDENROD]))
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
  expect(t.legendTitle).toBe('Genotypes')
  expect(new Set(t.legend.section)).toEqual(new Set(['Genotypes']))
})

test('each record takes the records band’s color: its SV class’s, else the default feature color, under no picked color and under phaseSet', async () => {
  for (const color of [undefined, { field: 'phaseSet' }]) {
    const display = color ? { encoding: { color } } : {}
    const svs = await engine.variants({ ...DOG_SV, display })
    expect(svs.variants.type).toEqual(['duplication'])
    expect(svs.variants.color).toEqual(['#377eb8'])
    const snvs = await engine.variants({ ...DOG_VCF, display })
    expect(new Set(snvs.variants.color)).toEqual(new Set([GOLDENROD]))
  }
})

test('under a picked color each record takes its alt cells’ hue at full dose', async () => {
  const t = await engine.variants({
    ...DOG_VCF,
    display: { encoding: { color: { value: '#cc3300' } } },
  })
  const hom = t.cells.color.filter((_, i) => t.cells.genotype[i] === '1/1')
  expect(new Set(hom)).toEqual(new Set(['#cc3300']))
  expect(new Set(t.variants.color)).toEqual(new Set(['#cc3300']))
})

test('the key takes the title encoding.color.legend gives it', async () => {
  const t = await engine.variants({
    ...DOG_VCF,
    display: { encoding: { color: { legend: { title: 'Calls' } } } },
  })
  expect(t.legendTitle).toBe('Calls')
})

test('drawing reference calls fills the grid, one cell a sample a site', async () => {
  const t = await engine.variants({
    ...DOG_VCF,
    display: { genotypes: { reference: { show: true } } },
  })
  expect(t.cells.variant.length).toBe(490 * 39)
  const ref = t.cells.color.filter((_, i) => t.cells.dosage[i] === 0)
  expect(new Set(ref).size).toBeGreaterThan(0)
})

test('haplotype rows split each sample, and an unphased call paints as unphased', async () => {
  const t = await engine.variants({
    ...DOG_VCF,
    display: { rows: 'haplotype' },
  })
  expect(t.rows.name).toHaveLength(78)
  expect(new Set(t.rows.sample).size).toBe(39)
  expect(new Set(t.rows.haplotype)).toEqual(new Set([1, 2]))
  expect(
    t.rows.name.every(
      (name, i) => name === `${t.rows.sample[i]} HP${t.rows.haplotype[i]}`,
    ),
  ).toBe(true)
  const unphased = t.cells.color.filter((_, i) =>
    t.cells.genotype[i]!.includes('/'),
  )
  expect(new Set(unphased).size).toBe(2)
  expect(t.legend.label.some(l => /unphased/i.test(l))).toBe(true)
  t.cells.genotype.forEach((gt, i) => {
    const d = t.cells.dosage[i]
    const hp = t.rows.haplotype[t.rows.name.indexOf(t.cells.row[i]!)]! - 1
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
    display: { filter: [{ field: 'minorAlleleFrequency', gte: 0.3 }] },
  })
  expect(common.variants.start.length).toBeGreaterThan(0)
  expect(common.variants.start.length).toBeLessThan(all.variants.start.length)
  const late = await engine.variants({
    ...DOG_VCF,
    display: { filter: ['jexl:feature.start > 38262000'] },
  })
  expect(Math.min(...late.variants.start)).toBeGreaterThan(38262000)
})

test('each row takes the display’s rows.color from the samples file, under the attribute’s key', async () => {
  const t = await engine.variants({
    ...DOG_SV,
    display: { rows: { color: { field: 'group' } } },
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
  const reordered = await engine.variants({
    ...DOG_SV,
    display: {
      rows: { color: { field: 'group' }, sort: [...t.rows.name].reverse() },
    },
  })
  expect(reordered.rows.color).toEqual([...t.rows.color].reverse())
  const plain = await engine.variants(DOG_SV)
  expect(new Set(plain.rows.color)).toEqual(new Set(['']))
  expect(plain.rowLegend.label).toEqual([])
})

test('a rows.annotations key is never the row key: with no rows.color the rows have none', async () => {
  const annotated = await engine.variants({
    ...DOG_SV,
    display: { rows: { annotations: ['group'] } },
  })
  expect(annotated.rowLegendTitle).toBe('')
  expect(annotated.rowLegend.label).toEqual([])
  expect(new Set(annotated.rows.color)).toEqual(new Set(['']))
  const pinned = annotated.rows.name[0]!
  const both = await engine.variants({
    ...DOG_SV,
    display: {
      rows: {
        annotations: ['group'],
        color: { field: 'group' },
        colors: { [pinned]: '#123456' },
      },
    },
  })
  expect(both.rowLegendTitle).toBe('Group')
  expect(both.rowLegend.color).toContain('#123456')
})

test('a row rows.colors pins takes its key entry by its rows.labels label, as the display keys it', async () => {
  const plain = await engine.variants(DOG_SV)
  const pinned = plain.rows.name[0]!
  const t = await engine.variants({
    ...DOG_SV,
    display: {
      rows: {
        color: { field: 'group' },
        colors: { [pinned]: '#123456' },
        labels: { [pinned]: 'Pinned dog' },
      },
    },
  })
  const at = t.rowLegend.label.indexOf('Pinned dog')
  expect(at).toBeGreaterThan(-1)
  expect(t.rowLegend.color[at]).toBe('#123456')
  expect(t.rowLegend.label).not.toContain(pinned)
})

test('the rows take the arrangement `rows` saves: its order first, its labels, its focus', async () => {
  const plain = await engine.variants(DOG_VCF)
  const [a, b, c] = plain.rows.name.slice(-3) as [string, string, string]
  const t = await engine.variants({
    ...DOG_VCF,
    display: { rows: { sort: [c, a], labels: { [c]: 'Proband' } } },
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

// A tree that arrived as data leads the order with its leaves, as the
// display's rowOrder does, where rows.sort alone would keep the file's order.
test('a supplied rows.tree orders the rows by its leaves', async () => {
  const plain = await engine.variants(DOG_VCF)
  const [a, b, c] = plain.rows.name as [string, string, string]
  const t = await engine.variants({
    ...DOG_VCF,
    display: { rows: { tree: `((${c},${b}),${a});` } },
  })
  expect(t.rows.name.slice(0, 3)).toEqual([c, b, a])
  expect(t.rows.name.slice(3)).toEqual(plain.rows.name.slice(3))
})

// One narrowing, as the display's: rows.filter over the samples file's
// attribute, then rows.kept, narrows the fetch and the rows alike.
test('the rows take rows.filter over the samples file, then rows.kept', async () => {
  const plain = await engine.variants({
    ...DOG_SV,
    display: { rows: { color: { field: 'group' } } },
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
  const wolves = plain.rows.name.filter(n => groupOf.get(n) === 'Gray wolf')
  expect(wolves.length).toBeGreaterThan(1)
  const filtered = await engine.variants({
    ...DOG_SV,
    display: { rows: { filter: [{ field: 'group', equal: 'Gray wolf' }] } },
  })
  expect(filtered.rows.name).toEqual(wolves)
  expect(filtered.cells.row).toEqual(
    plain.cells.row.filter(row => wolves.includes(row)),
  )
  const both = await engine.variants({
    ...DOG_SV,
    display: {
      rows: {
        filter: [{ field: 'group', equal: 'Gray wolf' }],
        kept: [wolves[0]!, plain.rows.name.find(n => !wolves.includes(n))!],
      },
    },
  })
  expect(both.rows.name).toEqual([wolves[0]])
  const none = await engine.variants({
    ...DOG_VCF,
    display: { rows: { kept: ['no such sample'] } },
  })
  expect(none.rows.name).toEqual([])
  expect(none.cells.row).toEqual([])
})

test('a sample named in the order places each of its haplotype rows', async () => {
  const plain = await engine.variants(DOG_VCF)
  const last = plain.rows.name.at(-1)!
  const t = await engine.variants({
    ...DOG_VCF,
    display: { rows: { field: 'haplotype', sort: [last] } },
  })
  expect(t.rows.name.slice(0, 2)).toEqual([`${last} HP1`, `${last} HP2`])
  expect(t.rows.sample.slice(0, 2)).toEqual([last, last])
})

test('a sample-keyed label composes with each haplotype, an own entry exact', async () => {
  const plain = await engine.variants(DOG_VCF)
  const [first, second] = plain.rows.name
  const t = await engine.variants({
    ...DOG_VCF,
    display: {
      rows: {
        field: 'haplotype',
        labels: { [first!]: 'Mother', [`${second} HP2`]: 'paternal' },
      },
    },
  })
  const labelOf = (name: string) => t.rows.label[t.rows.name.indexOf(name)]
  expect(labelOf(`${first} HP1`)).toBe('Mother HP1')
  expect(labelOf(`${first} HP2`)).toBe('Mother HP2')
  expect(labelOf(`${second} HP2`)).toBe('paternal')
})

test('a sample mode export ranks a sample at its first haplotype entry', async () => {
  const plain = await engine.variants(DOG_VCF)
  const [first, second, third] = plain.rows.name
  const t = await engine.variants({
    ...DOG_VCF,
    display: { rows: { sort: [`${third} HP2`, `${second} HP1`, first!] } },
  })
  expect(t.rows.name.slice(0, 3)).toEqual([third, second, first])
  expect(new Set(t.rows.haplotype)).toEqual(new Set([0]))
})

test('a facet stacks the rows in a band per value of the samples file’s attribute', async () => {
  const t = await engine.variants({
    ...DOG_SV,
    display: { facet: { field: 'group', sort: ['Gray wolf'] } },
  })
  expect(t.bands.label[0]).toBe('Gray wolf')
  expect(t.bands.label.slice(1)).toEqual([...t.bands.label.slice(1)].sort())
  const runs = t.rows.band.filter((band, r) => band !== t.rows.band[r - 1])
  expect(runs).toEqual(t.bands.key)
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

test("a split VCF's records list the samples their own contig's file lists", async () => {
  const split = (contig: string) =>
    pathToFileURL(
      path.resolve(
        `plugins/variants/src/SplitVcfTabixAdapter/test_data/${contig}.vcf.gz`,
      ),
    ).href
  const { vcf } = await engine.features({
    adapterConfig: {
      type: 'SplitVcfTabixAdapter',
      vcfGzLocationMap: {
        ctgA: { uri: split('ctgA') },
        ctgB: { uri: split('ctgB') },
      },
      indexLocationMap: {
        ctgA: { uri: `${split('ctgA')}.tbi` },
        ctgB: { uri: `${split('ctgB')}.tbi` },
      },
      indexType: 'TBI',
    },
    regions: [
      { refName: 'ctgA', start: 0, end: 1000 },
      { refName: 'ctgB', start: 0, end: 1000 },
    ],
    bpPerPx: 1,
  })
  expect(vcf!.samples).toEqual({
    feature: [0, 0, 1, 1],
    sample: ['onlyA', 'shared', 'shared', 'onlyB'],
  })
  expect(vcf!.format.GT).toEqual(['0/1', '1/1', '0/1', '1/1'])
})

test('a samples file leaving out a VCF sample warns, as the display does', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'samples-'))
  const vcf = path.join(dir, 'two.vcf')
  const tsv = path.join(dir, 'samples.tsv')
  writeFileSync(
    vcf,
    [
      '##fileformat=VCFv4.2',
      '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">',
      '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\ts1\ts2',
      'ctgA\t100\t.\tA\tG\t50\tPASS\t.\tGT\t0/1\t1/1',
    ].join('\n'),
  )
  writeFileSync(tsv, 'name\tgroup\ns1\ta\n')
  const t = await engine.variants({
    adapterConfig: {
      type: 'VcfAdapter',
      vcfLocation: { uri: pathToFileURL(vcf).href },
      samplesTsvLocation: { uri: pathToFileURL(tsv).href },
    },
    region: { refName: 'ctgA', start: 0, end: 1000 },
    display: { genotypes: { show: true } },
  })
  expect(t.rows.name).toEqual(['s1'])
  expect(t.warnings).toHaveLength(1)
  expect(t.warnings[0]).toContain('1 of the 2 samples in the VCF')
})

test("a samples file's label composes with each haplotype in the rows' labels", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'labels-'))
  const vcf = path.join(dir, 'two.vcf')
  const tsv = path.join(dir, 'samples.tsv')
  writeFileSync(
    vcf,
    [
      '##fileformat=VCFv4.2',
      '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">',
      '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\ts1\ts2',
      'ctgA\t100\t.\tA\tG\t50\tPASS\t.\tGT\t0|1\t1',
    ].join('\n'),
  )
  writeFileSync(tsv, 'name\tlabel\ns1\tMom\ns2\tDad\n')
  const t = await engine.variants({
    adapterConfig: {
      type: 'VcfAdapter',
      vcfLocation: { uri: pathToFileURL(vcf).href },
      samplesTsvLocation: { uri: pathToFileURL(tsv).href },
    },
    region: { refName: 'ctgA', start: 0, end: 1000 },
    display: { rows: 'haplotype' },
  })
  expect(t.rows.name).toEqual(['s1 HP1', 's1 HP2', 's2 HP1'])
  expect(t.rows.label).toEqual(['Mom HP1', 'Mom HP2', 'Dad'])
})

test('a no-call at a site with no ALT has no dosage, and an all-missing FORMAT key is no flag', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'noalt-'))
  const vcf = path.join(dir, 'noalt.vcf')
  writeFileSync(
    vcf,
    [
      '##fileformat=VCFv4.2',
      '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">',
      '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\ts1\ts2',
      'ctgA\t100\t.\tA\t.\t50\tPASS\t.\tGT:XX\t0/0:.\t./.:.',
      'ctgA\t200\t.\tC\tT\t50\tPASS\t.\tGT:XX\t0/1:.\t1/1:.',
    ].join('\n'),
  )
  const adapterConfig = {
    type: 'VcfAdapter',
    vcfLocation: { uri: pathToFileURL(vcf).href },
  }
  const region = { refName: 'ctgA', start: 0, end: 1000 }
  const t = await engine.variants({
    adapterConfig,
    region,
    display: { genotypes: { reference: { show: true } } },
  })
  const noAlt = t.variants.start.indexOf(99)
  const cell = (genotype: string) =>
    t.cells.dosage[
      t.cells.genotype.findIndex(
        (gt, i) => gt === genotype && t.cells.variant[i] === noAlt,
      )
    ]
  expect(cell('0/0')).toBe(0)
  expect(cell('./.')).toBeNull()

  const { vcf: records } = await engine.features({
    adapterConfig,
    region,
    bpPerPx: 1,
  })
  const xx = records!.formatFields.key.indexOf('XX')
  expect(records!.formatFields.type[xx]).toBe('String')
  expect(records!.format.XX).toEqual([null, null, null, null])
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

test('a record crossing two regions lists its samples and consequences once, under its first row', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'crossing-'))
  const vcf = path.join(dir, 'crossing.vcf')
  writeFileSync(
    vcf,
    [
      '##fileformat=VCFv4.2',
      '##INFO=<ID=CSQ,Number=.,Type=String,Description="Consequence annotations from Ensembl VEP. Format: Allele|Consequence">',
      '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">',
      '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\ts1\ts2',
      `ctgA\t100\t.\t${'A'.repeat(200)}\tA\t50\tPASS\tCSQ=A|frameshift_variant,A|intron_variant\tGT\t0/1\t1/1`,
    ].join('\n'),
  )
  const adapterConfig = {
    type: 'VcfAdapter',
    vcfLocation: { uri: pathToFileURL(vcf).href },
  }
  const regions = [
    { refName: 'ctgA', start: 0, end: 200 },
    { refName: 'ctgA', start: 200, end: 400 },
  ]
  const { features, vcf: records } = await engine.features({
    adapterConfig,
    regions,
    bpPerPx: 1,
  })
  expect(features.region).toEqual([0, 1])
  expect(records!.samples).toEqual({ feature: [0, 0], sample: ['s1', 's2'] })
  expect(records!.format.GT).toEqual(['0/1', '1/1'])
  expect(records!.annotations.feature).toEqual([0, 0])
  expect(records!.annotations.Consequence).toEqual([
    'frameshift_variant',
    'intron_variant',
  ])

  const t = await engine.variants({ adapterConfig, regions })
  expect(t.variants.region).toEqual([0, 1])
  expect(t.annotations.variant).toEqual([0, 0])
  expect(t.annotations.Consequence).toEqual([
    'frameshift_variant',
    'intron_variant',
  ])
})

test('the rows sit on the reference calls’ grey unless those draw as cells', async () => {
  const hidden = await engine.variants(DOG_VCF)
  expect(hidden.rowBackground).toBe(REFERENCE_COLOR)
  const shown = await engine.variants({
    ...DOG_VCF,
    display: { genotypes: { reference: { show: true } } },
  })
  expect(shown.rowBackground).toBe('')
})

test('the rows divide the display’s default height, or draw at rows.step', async () => {
  const fit = await engine.variants(DOG_VCF)
  expect(fit.height).toBe(DEFAULT_VARIANT_DISPLAY_HEIGHT)
  expect(fit.rowHeight).toBeCloseTo(
    DEFAULT_VARIANT_DISPLAY_HEIGHT / fit.rows.name.length,
  )
  const written = await engine.variants({
    ...DOG_VCF,
    display: { height: 500 },
  })
  expect(written.height).toBe(500)
  expect(written.rowHeight).toBeCloseTo(500 / written.rows.name.length)
  const stepped = await engine.variants({
    ...DOG_VCF,
    display: { rows: { step: 3 } },
  })
  expect(stepped.height).toBe(DEFAULT_VARIANT_DISPLAY_HEIGHT)
  expect(stepped.rowHeight).toBe(3)
})
