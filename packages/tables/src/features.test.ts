import { createTablesEngine } from './index.ts'
import { BIGBED, GFF3 } from './volvox.fixture.ts'

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
