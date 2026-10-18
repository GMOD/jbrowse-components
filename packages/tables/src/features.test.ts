import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { createTablesEngine } from './index.ts'
import { BIGBED, DOG_VCF, GFF3 } from './volvox.fixture.ts'

const engine = createTablesEngine()

/** Every feature at full size, as the tests below read the layout. */
const GROW = { heightMode: 'grow' }

test('a GFF3 region comes back as the feature display lays it out', async () => {
  const t = await engine.features({ ...GFF3, display: GROW })
  const n = t.features.id.length
  expect(n).toBeGreaterThan(10)
  for (const table of [t.features, t.rects, t.lines, t.labels]) {
    const lengths = new Set(Object.values(table).map(c => c.length))
    expect(lengths.size).toBe(1)
  }
  // no two features on one row overlap, the display's packing
  const tops = new Map<number, [number, number][]>()
  for (let i = 0; i < n; i++) {
    const row = tops.get(t.features.top[i]!) ?? []
    row.push([t.features.start[i]!, t.features.end[i]!])
    tops.set(t.features.top[i]!, row)
  }
  for (const spans of tops.values()) {
    spans.sort((a, b) => a[0] - b[0])
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i]![0]).toBeGreaterThanOrEqual(spans[i - 1]![1])
    }
  }
  // every box sits inside its feature, in span and in height
  for (let i = 0; i < t.rects.start.length; i++) {
    const f = t.rects.feature[i]!
    expect(t.rects.start[i]).toBeGreaterThanOrEqual(t.features.start[f]!)
    expect(t.rects.end[i]).toBeLessThanOrEqual(t.features.end[f]!)
    expect(t.rects.top[i]).toBeGreaterThanOrEqual(t.features.top[f]!)
    expect(t.rects.top[i]! + t.rects.height[i]!).toBeLessThanOrEqual(
      t.features.bottom[f]! + 1e-3,
    )
  }
  expect(t.features.name).toContain('EDEN')
  expect(t.labels.text).toContain('EDEN')
  expect(t.subfeatures.type).toContain('mRNA')
  for (const color of t.rects.color) {
    expect(color).toMatch(/^#[0-9a-f]{6}$/)
  }
  expect(t.chevrons.position.length).toBeGreaterThan(0)
  expect(t.arrows.position.length).toBeGreaterThan(0)
})

test("the display filter's gene category splits the features", async () => {
  const all = await engine.features({ ...GFF3, display: GROW })
  const genes = await engine.features({
    ...GFF3,
    display: { ...GROW, filter: { genes: 'only' } },
  })
  const rest = await engine.features({
    ...GFF3,
    display: { ...GROW, filter: { genes: 'exclude' } },
  })
  expect(genes.features.type).toContain('gene')
  expect(genes.features.type).not.toContain('contig')
  expect(rest.features.type).toContain('contig')
  expect(rest.features.type).not.toContain('gene')
  expect(genes.features.id.length + rest.features.id.length).toBe(
    all.features.id.length,
  )
})

test('the display settings reach the tables', async () => {
  const shown = await engine.features({ ...GFF3, display: GROW })
  const bare = await engine.features({
    ...GFF3,
    display: { ...GROW, showLabels: 'none', displayDirectionalChevrons: false },
  })
  expect(bare.labels.text).toEqual([])
  expect(bare.chevrons.position).toEqual([])
  // the rows close up once no label takes a line under a feature
  expect(bare.height).toBeLessThan(shown.height)

  const constant = await engine.features({
    ...GFF3,
    display: { ...GROW, color: { value: '#123456' } },
  })
  expect(constant.rects.color).toContain('#123456')
})

test('a color field paints through its scale and keys what it painted', async () => {
  const t = await engine.features({
    ...GFF3,
    display: { ...GROW, color: { field: 'type' } },
  })
  expect(t.legend.label.length).toBeGreaterThan(1)
  expect(new Set(t.rects.color).size).toBeGreaterThan(1)
  for (const color of t.legend.color) {
    expect(t.rects.color).toContain(color)
  }
})

test('a BigBed region lays out', async () => {
  const t = await engine.features({ ...BIGBED, display: GROW })
  expect(t.features.id.length).toBeGreaterThan(0)
  expect(t.rects.start.length).toBeGreaterThan(0)
})

test('a transcript label names its transcript and the gene it belongs to', async () => {
  const t = await engine.features({
    ...GFF3,
    bpPerPx: 5,
    display: { ...GROW, subfeatureLabels: 'below' },
  })
  const sub = t.labels.subfeature
    .map((s, i) => i)
    .filter(i => t.labels.subfeature[i]! >= 0)
  expect(sub.length).toBeGreaterThan(0)
  for (const i of sub) {
    const s = t.labels.subfeature[i]!
    expect(t.labels.feature[i]).toBe(t.subfeatures.feature[s])
    expect(t.subfeatures.name[s]).toBe(t.labels.text[i])
  }
  expect(Math.min(...t.labels.feature)).toBeGreaterThanOrEqual(0)
})

test('a gene’s boxes, lines and arrows name the transcript they draw', async () => {
  const t = await engine.features({ ...GFF3, display: GROW })
  const eden = t.subfeatures.name.flatMap((name, s) =>
    name.startsWith('EDEN.') ? [s] : [],
  )
  expect(eden.length).toBe(3)
  for (const table of [t.rects, t.lines, t.arrows]) {
    table.subfeature.forEach((s, i) => {
      if (s >= 0) {
        expect(t.subfeatures.feature[s]).toBe(table.feature[i])
      }
    })
  }
  t.rects.subfeature.forEach((s, i) => {
    if (s >= 0) {
      expect(t.rects.start[i]).toBeGreaterThanOrEqual(t.subfeatures.start[s]!)
      expect(t.rects.end[i]).toBeLessThanOrEqual(t.subfeatures.end[s]!)
      expect(t.rects.top[i]).toBeGreaterThanOrEqual(t.subfeatures.top[s]!)
      expect(t.rects.top[i]).toBeLessThan(t.subfeatures.bottom[s]!)
    }
  })
  for (const s of eden) {
    expect(t.rects.subfeature.filter(x => x === s).length).toBeGreaterThan(1)
  }
  // EDEN.3 starts later than its siblings, so its first exon is its own
  const late = eden.find(s => t.subfeatures.start[s] === 1299)!
  const boxes = t.rects.start.filter((_, i) => t.rects.subfeature[i] === late)
  expect(Math.min(...boxes)).toBe(1299)
})

test('the file’s fields come keyed as the file writes them, beside the table’s own', async () => {
  const t = await engine.features({ ...GFF3, display: GROW })
  const eden = t.features.name.indexOf('EDEN')
  expect(t.attributes.ID![eden]).toBe('EDEN')
  expect(t.attributes.Name![eden]).toBe('EDEN')
  expect(t.attributes.Note![eden]).toEqual(['protein kinase'])
  expect(t.attributes.source![eden]).toBe('example')
  expect(t.features.id[eden]).not.toBe('EDEN')
  for (const column of Object.values(t.attributes)) {
    expect(column).toHaveLength(t.features.id.length)
  }
  const transcript = t.subfeatures.name.indexOf('EDEN.2')
  expect(t.subfeatureAttributes.ID![transcript]).toBe('EDEN.2')
  expect(t.subfeatureAttributes.Parent![transcript]).toEqual(['EDEN'])
  expect(t.subfeatureAttributes.Index![transcript]).toBe('1')
  const contig = t.features.type.indexOf('contig')
  expect(t.attributes.multivalue![contig]).toEqual(['val1', 'val2', 'val3'])
  expect(t.attributes.multivalue![eden]).toBeNull()
  expect(t.attributes).not.toHaveProperty('id')
  expect(t.attributes).not.toHaveProperty('start')
  // a GFF3 declares nothing, so each key is text, a list where the spec or a
  // record lists several
  const declared = (key: string) => {
    const i = t.attributeFields.key.indexOf(key)
    return `${t.attributeFields.type[i]} ${t.attributeFields.number[i]}`
  }
  expect(declared('ID')).toBe('String 1')
  expect(declared('Index')).toBe('String 1')
  expect(declared('Parent')).toBe('String .')
  expect(declared('multivalue')).toBe('String .')
  expect(declared('score')).toBe('Float 1')
})

test('a BigBed’s fields take the types its autoSql declares', async () => {
  const t = await engine.features({ ...BIGBED, display: GROW })
  const fields = t.attributeFields
  const declared = Object.fromEntries(
    fields.key.map((key, i) => [key, `${fields.type[i]} ${fields.number[i]}`]),
  )
  expect(declared).toMatchObject({ score: 'Integer 1', reserved: 'String 1' })
  expect(fields.description[fields.key.indexOf('geneName')]).toBe('Gene name')
  expect(fields.key).not.toContain('chromStarts')
  for (const [key, type] of Object.entries(declared)) {
    if (type.startsWith('Integer')) {
      for (const v of t.attributes[key]!) {
        expect(v === null || Number.isInteger(v)).toBe(true)
      }
    }
  }
})

test('the default fit gives up what the browser gives up to fit the track', async () => {
  const label = (t: { labels: { text: string[] } }) =>
    t.labels.text.includes('EDEN')
  const fit = await engine.features(GFF3)
  const bottom = Math.max(...fit.features.bottom)
  expect(bottom).toBeLessThanOrEqual(100)
  expect(label(fit)).toBe(false)
  const tall = await engine.features({ ...GFF3, display: { height: 2000 } })
  expect(label(tall)).toBe(true)
  const grown = await engine.features({ ...GFF3, display: GROW })
  expect(label(grown)).toBe(true)
  expect(Math.max(...grown.features.bottom)).toBeGreaterThan(bottom)
})

test('regions of one contig lay out together, a feature on one row in each', async () => {
  const { region: _, ...args } = GFF3
  const exons = [
    { refName: 'ctgA', start: 1000, end: 1600 },
    { refName: 'ctgA', start: 2900, end: 4000 },
    { refName: 'ctgA', start: 4900, end: 5600 },
    { refName: 'ctgA', start: 6900, end: 9100 },
  ]
  const t = await engine.features({
    ...args,
    regions: exons,
    bpPerPx: 5,
    display: GROW,
  })
  expect(new Set(t.features.region)).toEqual(new Set([0, 1, 2, 3]))
  const eden = t.features.id[t.features.name.indexOf('EDEN')]
  expect(t.features.region.filter((_, i) => t.features.id[i] === eden)).toEqual(
    [0, 1, 2, 3],
  )
  const tops = new Map<string, Set<number>>()
  t.features.id.forEach((id, i) => {
    tops.set(id, (tops.get(id) ?? new Set()).add(t.features.top[i]!))
  })
  for (const rows of tops.values()) {
    expect(rows.size).toBe(1)
  }
  // read one at a time, each region packs its own rows and EDEN moves
  const apart = await Promise.all(
    exons.map(region =>
      engine.features({ ...args, region, bpPerPx: 5, display: GROW }),
    ),
  )
  const edenTops = apart.map(
    a => a.features.top[a.features.name.indexOf('EDEN')],
  )
  expect(new Set(edenTops).size).toBeGreaterThan(1)
  for (const table of [t.rects, t.lines, t.labels, t.subfeatures]) {
    table.feature.forEach((f, i) => {
      expect(t.features.region[f]).toBe(table.region[i])
    })
  }
})

test('a zoomed-in CDS carries its residues, lettered once a codon fits them', async () => {
  const region = { refName: 'ctgA', start: 1150, end: 1350 }
  const at = (bpPerPx: number, aminoAcids?: boolean) =>
    engine.features({ ...GFF3, region, bpPerPx, aminoAcids, display: GROW })
  const close = await at(0.1)
  const aa = close.aminoAcids
  const n = aa.start.length
  expect(n).toBeGreaterThan(30)
  expect(new Set(Object.values(aa).map(c => c.length))).toEqual(new Set([n]))
  for (let i = 0; i < n; i++) {
    expect(aa.end[i]! - aa.start[i]!).toBeLessThanOrEqual(3)
    expect(aa.text[i]!.slice(1)).toMatch(/^\d*$/)
    expect(aa.text[i]![0]).toBe(aa.aminoAcid[i])
    expect(aa.color[i]).toBe(aa.stopOrNonTriplet[i] ? '#ff0000' : '#000000')
    const f = aa.feature[i]!
    expect(aa.top[i]).toBeGreaterThanOrEqual(close.features.top[f]!)
    expect(aa.y[i]).toBeGreaterThan(aa.top[i]!)
    expect(aa.y[i]).toBeLessThan(aa.top[i]! + aa.height[i]!)
  }
  expect(aa.text.some(t => /\d/.test(t))).toBe(false)
  const closer = await at(0.05)
  expect(closer.aminoAcids.text.every(t => /^.\d+$/.test(t))).toBe(true)
  expect(close.glyph.aminoAcidHalo).toBe('#ffffff')

  const middle = await at(0.5)
  expect(middle.aminoAcids.start.length).toBe(n)
  expect(new Set(middle.aminoAcids.text)).toEqual(new Set(['']))

  expect((await at(2)).aminoAcids.start).toEqual([])
  expect((await at(0.1, false)).aminoAcids.start).toEqual([])
})

test('the display’s facet packs a section per value, each under its chip row', async () => {
  const plain = await engine.features({ ...GFF3, display: GROW })
  expect(plain.sections).toEqual({
    key: [''],
    label: [''],
    top: [0],
    height: [plain.height],
  })
  expect(new Set(plain.features.section)).toEqual(new Set(['']))
  expect(plain.glyph.sectionLabelHeight).toBe(0)

  const t = await engine.features({
    ...GFF3,
    display: { ...GROW, facet: 'strand' },
  })
  const chip = t.glyph.sectionLabelHeight
  expect(chip).toBeGreaterThan(0)
  expect(t.sections.label.length).toBeGreaterThan(1)
  expect(t.features.id.length).toBe(plain.features.id.length)
  t.sections.label.forEach((label, s) => {
    const top = t.sections.top[s]!
    const bottom = top + t.sections.height[s]!
    t.features.section.forEach((section, i) => {
      if (section === label) {
        expect(t.features.top[i]).toBeGreaterThanOrEqual(top + chip)
        expect(t.features.bottom[i]).toBeLessThanOrEqual(bottom + 1e-3)
      }
    })
    if (s > 0) {
      expect(top).toBe(t.sections.top[s - 1]! + t.sections.height[s - 1]!)
    }
  })
  t.features.strand.forEach((strand, i) => {
    const same = t.features.strand.indexOf(strand)
    expect(t.features.section[i]).toBe(t.features.section[same])
  })

  const [first, second] = t.sections.key
  const reordered = await engine.features({
    ...GFF3,
    display: { ...GROW, facet: { field: 'strand', domain: [second!, first!] } },
  })
  expect(reordered.sections.key.slice(0, 2)).toEqual([second, first])

  const hidden = await engine.features({
    ...GFF3,
    display: { ...GROW, facet: { field: 'strand', hidden: [first!] } },
  })
  expect(hidden.sections.key).not.toContain(first)
  expect(hidden.truncated).toBe(0)
  expect(hidden.features.id.length).toBeLessThan(t.features.id.length)
  await expect(
    engine.features({
      ...GFF3,
      display: { ...GROW, facet: { field: 'strand', hidden: t.sections.key } },
    }),
  ).rejects.toThrow(/every section/)
})

test('a facet on a feature field stamps each feature with its value', async () => {
  const t = await engine.features({
    ...GFF3,
    display: { ...GROW, facet: 'type' },
  })
  expect(t.sections.label.length).toBeGreaterThan(1)
  t.features.type.forEach((type, i) => {
    const same = t.features.type.indexOf(type)
    expect(t.features.section[i]).toBe(t.features.section[same])
  })
})

test('features a config writes inline lay out as the same features in a file do', async () => {
  const bed = path.resolve('test_data/volvox/arc_test.bed')
  const region = { refName: 'ctgA', start: 9000, end: 11000 }
  const fromFile = await engine.features({
    adapterConfig: {
      type: 'BedAdapter',
      bedLocation: {
        uri: pathToFileURL(bed).href,
        locationType: 'UriLocation',
      },
    },
    region,
    bpPerPx: 2,
  })
  const features = readFileSync(bed, 'utf8')
    .trim()
    .split('\n')
    .map(line => {
      const [refName, start, end, name] = line.split('\t')
      return { uniqueId: name, refName, start: +start!, end: +end!, name }
    })
  const fromConfig = await engine.features({
    adapterConfig: { type: 'FromConfigAdapter', features },
    region,
    bpPerPx: 2,
  })
  expect(fromConfig.features.name).toHaveLength(6)
  const { id: _, ...placed } = fromConfig.features
  const { id: __, ...filePlaced } = fromFile.features
  expect(placed).toEqual(filePlaced)
  expect(fromConfig.rects).toEqual(fromFile.rects)
  expect(fromConfig.labels).toEqual(fromFile.labels)
  expect(fromConfig.missingContig).toBe('')
})

test('a whole file reads as every contig it lists, each to its end', async () => {
  const { adapterConfig } = GFF3
  const whole = await engine.fileRegions({ adapterConfig })
  expect(whole.refName).toEqual(['ctgA', 'ctgB'])
  const regions = whole.refName.map((refName, i) => ({
    refName,
    start: whole.start[i]!,
    end: whole.end[i]!,
  }))
  const t = await engine.features({
    adapterConfig,
    regions,
    bpPerPx: 1e6,
    display: GROW,
  })
  const one = await engine.features({
    ...GFF3,
    region: { refName: 'ctgB', start: 0, end: 6079 },
    display: GROW,
  })
  const onB = t.features.region.flatMap((r, i) => (r === 1 ? [i] : []))
  expect(onB.map(i => t.features.name[i])).toEqual(one.features.name)
  expect(t.features.region.filter(r => r === 0).length).toBeGreaterThan(20)
})

test('a read past its row limit is refused, naming the table to read a region of', async () => {
  const { adapterConfig } = DOG_VCF
  const whole = await engine.fileRegions({ adapterConfig })
  const region = { refName: whole.refName[0]!, start: 0, end: whole.end[0]! }
  const cells = (await engine.variants({ adapterConfig, region })).cells
  await expect(
    engine.variants({ adapterConfig, region, rowLimit: cells.row.length - 1 }),
  ).rejects.toThrow(
    `the file gives ${cells.row.length} rows of cells, over the ${cells.row.length - 1}-row limit for a read with no region; pass a region`,
  )
  await expect(
    engine.variants({ adapterConfig, region, rowLimit: cells.row.length }),
  ).resolves.toBeDefined()
})
