import { createTablesEngine } from './index.ts'
import { COVERAGE_BIGWIG, SIGNED_BIGWIG } from './volvox.fixture.ts'

const engine = createTablesEngine()

test('a BigWig region comes back as the wiggle display scales and colors it', async () => {
  const t = await engine.wiggle(SIGNED_BIGWIG)
  const n = t.bins.start.length
  expect(n).toBeGreaterThan(100)
  for (const table of [t.bins, t.marks]) {
    expect(new Set(Object.values(table).map(c => c.length)).size).toBe(1)
  }
  expect(t.rendering).toBe('xyplot')
  expect(t.marks.start).toHaveLength(n)
  const pos = new Set<string>()
  const neg = new Set<string>()
  t.marks.score.forEach((score, i) => {
    ;(score < 0 ? neg : pos).add(t.marks.color[i]!)
    expect(t.marks.low[i]).toBe(0)
  })
  expect(pos.size).toBe(1)
  expect(neg.size).toBe(1)
  expect(pos).not.toEqual(neg)
  const [lo, hi] = t.domain
  expect(lo).toBeLessThanOrEqual(Math.min(...t.bins.score))
  expect(hi).toBeGreaterThanOrEqual(Math.max(...t.bins.score))

  const pinned = await engine.wiggle({
    ...SIGNED_BIGWIG,
    display: { scales: { y: { domainMin: -50, domainMax: 300 } } },
  })
  expect(pinned.domain).toEqual([-50, 300])
})

test('a zoomed-out min-max extent draws the max and min bands around the mean', async () => {
  const wide = { ...COVERAGE_BIGWIG, bpPerPx: 1000 }
  const plain = await engine.wiggle({ ...wide, display: { extent: 'none' } })
  expect(new Set(plain.marks.layer).size).toBe(1)
  const t = await engine.wiggle({ ...wide, display: { extent: 'min-max' } })
  expect(new Set(t.marks.layer).size).toBe(3)
  t.bins.score.forEach((score, i) => {
    expect(t.bins.min[i]).toBeLessThanOrEqual(score)
    expect(t.bins.max[i]).toBeGreaterThanOrEqual(score)
  })
  expect(t.bins.max.some((max, i) => max > t.bins.score[i]!)).toBe(true)
  expect(new Set(t.marks.color).size).toBe(3)
  expect(t.domain[1]).toBeGreaterThanOrEqual(Math.max(...t.bins.max))

  const max = await engine.wiggle({
    ...wide,
    display: { aggregate: 'max', extent: 'none' },
  })
  expect(max.marks.score).toEqual(t.bins.max)

  const line = await engine.wiggle({
    ...wide,
    display: { mark: 'line', extent: 'min-max' },
  })
  const band = line.marks.band.map((b, i) => i).filter(i => line.marks.band[i])
  expect(band).toHaveLength(line.bins.start.length)
  for (const i of band) {
    expect(line.marks.low[i]).toBeLessThanOrEqual(line.marks.score[i]!)
  }
})

test('density fades each bin from white at the pivot to the side it is on', async () => {
  const t = await engine.wiggle({ ...SIGNED_BIGWIG, display: { mark: 'span' } })
  expect(t.rendering).toBe('density')
  const lightness = (hex: string) =>
    Math.min(...[1, 3, 5].map(k => Number.parseInt(hex.slice(k, k + 2), 16)))
  for (const side of [1, -1]) {
    const byMagnitude = t.marks.score
      .map((score, i) => ({ score, light: lightness(t.marks.color[i]!) }))
      .filter(m => Math.sign(m.score) === side)
      .sort((a, b) => Math.abs(a.score) - Math.abs(b.score))
    expect(byMagnitude.length).toBeGreaterThan(10)
    for (let i = 1; i < byMagnitude.length; i++) {
      expect(byMagnitude[i]!.light).toBeLessThanOrEqual(
        byMagnitude[i - 1]!.light,
      )
    }
    expect(byMagnitude[0]!.light).toBeGreaterThan(byMagnitude.at(-1)!.light)
  }
  expect(new Set(t.marks.color).size).toBeGreaterThan(20)
})
