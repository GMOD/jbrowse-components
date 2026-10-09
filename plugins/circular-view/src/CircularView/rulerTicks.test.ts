import { rulerTicks } from './rulerTicks.ts'
import { Slice } from './slices.ts'

const TWO_PI = 2 * Math.PI

function wholeCircle(end: number, reversed = false) {
  return new Slice(
    { bpPerRadian: end / TWO_PI },
    {
      elided: false,
      widthBp: end,
      start: 0,
      end,
      refName: 'NC_012920.1',
      assemblyName: 'human_mito',
      reversed,
    },
    0,
  )
}

test('a 16.5 kb circle of radius 300 ticks every 200 bp and labels every kb', () => {
  const ticks = rulerTicks(wholeCircle(16_569), 300)
  expect(ticks).toHaveLength(Math.floor(16_569 / 200))
  expect(ticks.flatMap(t => (t.label ? [t.label] : []))).toEqual(
    Array.from({ length: 16 }, (_, i) => `${i + 1},000`),
  )
})

test("a tick marks its base's left edge, mirrored on a reversed slice", () => {
  const slice = wholeCircle(16_569)
  const at1000 = rulerTicks(slice, 300).find(t => t.base === 1000)!
  expect(at1000.radians).toBeCloseTo(999 / slice.bpPerRadian)
  const mirrored = rulerTicks(wholeCircle(16_569, true), 300).find(
    t => t.base === 1000,
  )!
  expect(mirrored.radians).toBeCloseTo(TWO_PI - 999 / slice.bpPerRadian)
})

test('a chromosome at whole-genome scale labels its ticks in megabases', () => {
  const chr1 = new Slice(
    { bpPerRadian: 1_400_000 * 350 },
    {
      elided: false,
      widthBp: 248_956_422,
      start: 0,
      end: 248_956_422,
      refName: 'chr1',
      assemblyName: 'hg38',
    },
    0,
  )
  expect(rulerTicks(chr1, 350).flatMap(t => t.label ?? [])).toEqual(['200M'])
})

test('a partial region ticks only inside its own bounds', () => {
  const slice = new Slice(
    { bpPerRadian: 1000 },
    {
      elided: false,
      widthBp: 3000,
      start: 10_100,
      end: 13_100,
      refName: 'ctgA',
      assemblyName: 'volvox',
    },
    0,
  )
  const bases = rulerTicks(slice, 100).map(t => t.base)
  expect(Math.min(...bases)).toBeGreaterThan(10_100)
  expect(Math.max(...bases)).toBeLessThanOrEqual(13_100)
})

test('an elided slice has no ticks', () => {
  const slice = new Slice(
    { bpPerRadian: 1000 },
    {
      elided: true,
      widthBp: 10,
      regions: [{ refName: 'ctgB', start: 0, end: 10, assemblyName: 'v' }],
    },
    0,
  )
  expect(rulerTicks(slice, 100)).toEqual([])
})

test('a ring closed on itself labels its first base, and leaves a major tick at its seam unlabelled', () => {
  const ticks = rulerTicks(wholeCircle(5000), 120, true)
  expect(ticks[0]).toEqual({ base: 1, radians: 0, label: '1' })
  expect(ticks.filter(t => t.base === 1)).toHaveLength(1)
  const labels = ticks.flatMap(t => (t.label ? [t.label] : []))
  expect(labels[0]).toBe('1')
  expect(ticks.find(t => t.base === 5000)).toMatchObject({ label: undefined })
})
