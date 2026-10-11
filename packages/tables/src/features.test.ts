import { createTablesEngine } from './index.ts'
import { BIGBED, GFF3 } from './volvox.fixture.ts'

const engine = createTablesEngine()

test('a GFF3 region comes back as the feature display lays it out', async () => {
  const t = await engine.features(GFF3)
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
  const shown = await engine.features(GFF3)
  const bare = await engine.features({
    ...GFF3,
    display: { showLabels: 'none', displayDirectionalChevrons: false },
  })
  expect(bare.labels.text).toEqual([])
  expect(bare.chevrons.position).toEqual([])
  // the rows close up once no label takes a line under a feature
  expect(bare.height).toBeLessThan(shown.height)

  const constant = await engine.features({
    ...GFF3,
    display: { color: { value: '#123456' } },
  })
  expect(constant.rects.color).toContain('#123456')
})

test('a color field paints through its scale and keys what it painted', async () => {
  const t = await engine.features({
    ...GFF3,
    display: { color: { field: 'type' } },
  })
  expect(t.legend.label.length).toBeGreaterThan(1)
  expect(new Set(t.rects.color).size).toBeGreaterThan(1)
  for (const color of t.legend.color) {
    expect(t.rects.color).toContain(color)
  }
})

test('a BigBed region lays out', async () => {
  const t = await engine.features(BIGBED)
  expect(t.features.id.length).toBeGreaterThan(0)
  expect(t.rects.start.length).toBeGreaterThan(0)
})
