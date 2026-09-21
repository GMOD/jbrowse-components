import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import {
  LD_INDEX_SWATCH,
  LD_MISSING_SWATCH,
  ldBinColor,
  ldIndexColor,
  ldLegend,
} from './ldBins.ts'

const defaults = { domain: [], palette: [] }
const binOf = ldBinColor(defaults)

test('missing or NaN r² renders grey, distinct from every bin', () => {
  const grey = binOf(undefined)
  expect(binOf(Number.NaN)).toBe(grey)
  for (const r2 of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    expect(binOf(r2)).not.toBe(grey)
  }
})

test('the five r² bins are distinct colors', () => {
  const colors = [0.1, 0.3, 0.5, 0.7, 0.9].map(binOf)
  expect(new Set(colors).size).toBe(5)
})

test('bin edges use >= lower bounds', () => {
  // a value on the boundary lands in the higher bin
  expect(binOf(0.8)).toBe(binOf(0.95))
  expect(binOf(0.6)).toBe(binOf(0.75))
  expect(binOf(0.2)).toBe(binOf(0.35))
  // just below the boundary is the next bin down
  expect(binOf(0.79)).toBe(binOf(0.6))
  expect(binOf(0.19)).toBe(binOf(0))
})

test('index color is distinct from bin and grey colors', () => {
  const others = [undefined, 0.1, 0.3, 0.5, 0.7, 0.9].map(binOf)
  expect(others).not.toContain(ldIndexColor)
})

test('legend swatches and the color lookup share one palette', () => {
  expect(ldIndexColor).toBe(cssColorToABGR(LD_INDEX_SWATCH.color))
  expect(binOf(undefined)).toBe(cssColorToABGR(LD_MISSING_SWATCH.color))
  const sampleR2: Record<string, number> = {
    '≥ 0.8': 0.9,
    '0.6 – 0.8': 0.7,
    '0.4 – 0.6': 0.5,
    '0.2 – 0.4': 0.3,
    '< 0.2': 0.1,
  }
  for (const { label, color } of ldLegend(defaults)) {
    if (label in sampleR2) {
      expect(binOf(sampleR2[label])).toBe(cssColorToABGR(color))
    }
  }
})

// The grey means "absent from the LD data", so a bin past the palette's end
// cannot borrow it — the points in that bin are in the data.
test('a cut past the palette takes a colour, not the no-data grey', () => {
  const custom = { domain: ['0.2', '0.4', '0.6', '0.8', '0.9'], palette: [] }
  const paint = ldBinColor(custom)
  expect(paint(0.95)).not.toBe(cssColorToABGR(LD_MISSING_SWATCH.color))
  expect(paint(0.95)).not.toBe(paint(0.85))
  const bins = ldLegend(custom).slice(1, -1)
  expect(bins).toHaveLength(6)
  expect(bins.map(s => s.color)).not.toContain(LD_MISSING_SWATCH.color)
})

test('a config moves the cuts and recolours the bins', () => {
  const custom = { domain: ['0.5'], palette: ['#000080', '#800000'] }
  const paint = ldBinColor(custom)
  expect(paint(0.49)).toBe(cssColorToABGR('#000080'))
  expect(paint(0.5)).toBe(cssColorToABGR('#800000'))
  expect(ldLegend(custom).map(s => s.label)).toEqual([
    'Index SNP',
    '≥ 0.5',
    '< 0.5',
    'No LD data',
  ])
})

test('cuts written high to low are read ascending, on the points and in the key', () => {
  const custom = {
    domain: ['0.8', '0.2'],
    palette: ['#000080', '#008000', '#800000'],
  }
  expect(ldBinColor(custom)(0.5)).toBe(cssColorToABGR('#008000'))
  expect(ldLegend(custom).map(s => s.label)).toEqual([
    'Index SNP',
    '≥ 0.8',
    '0.2 – 0.8',
    '< 0.2',
    'No LD data',
  ])
})
