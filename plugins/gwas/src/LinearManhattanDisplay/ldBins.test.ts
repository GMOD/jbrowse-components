import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import {
  LD_INDEX_SWATCH,
  LD_LEGEND,
  LD_MISSING_SWATCH,
  ldBinColor,
  ldIndexColor,
} from './ldBins.ts'

test('missing or NaN r² renders grey, distinct from every bin', () => {
  const grey = ldBinColor(undefined)
  expect(ldBinColor(Number.NaN)).toBe(grey)
  for (const r2 of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    expect(ldBinColor(r2)).not.toBe(grey)
  }
})

test('the five r² bins are distinct colors', () => {
  const colors = [0.1, 0.3, 0.5, 0.7, 0.9].map(ldBinColor)
  expect(new Set(colors).size).toBe(5)
})

test('bin edges use >= lower bounds', () => {
  // a value on the boundary lands in the higher bin
  expect(ldBinColor(0.8)).toBe(ldBinColor(0.95))
  expect(ldBinColor(0.6)).toBe(ldBinColor(0.75))
  expect(ldBinColor(0.2)).toBe(ldBinColor(0.35))
  // just below the boundary is the next bin down
  expect(ldBinColor(0.79)).toBe(ldBinColor(0.6))
  expect(ldBinColor(0.19)).toBe(ldBinColor(0))
})

test('index color is distinct from bin and grey colors', () => {
  const others = [undefined, 0.1, 0.3, 0.5, 0.7, 0.9].map(ldBinColor)
  expect(others).not.toContain(ldIndexColor)
})

test('legend swatches and the color lookup share one palette', () => {
  // index + grey endpoints
  expect(ldIndexColor).toBe(cssColorToABGR(LD_INDEX_SWATCH.color))
  expect(ldBinColor(undefined)).toBe(cssColorToABGR(LD_MISSING_SWATCH.color))
  // every legend row's CSS color matches what the lookup paints for that row
  const sampleR2: Record<string, number> = {
    '0.8 – 1.0': 0.9,
    '0.6 – 0.8': 0.7,
    '0.4 – 0.6': 0.5,
    '0.2 – 0.4': 0.3,
    '< 0.2': 0.1,
  }
  for (const { label, color } of LD_LEGEND) {
    if (label in sampleR2) {
      expect(ldBinColor(sampleR2[label])).toBe(cssColorToABGR(color))
    }
  }
})
