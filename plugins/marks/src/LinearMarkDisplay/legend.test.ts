import { encodeFeatures } from '@jbrowse/core/util/markEncoding'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { buildMarkLegend, categoryLabel, markColorScales } from './legend.ts'

import type { MarkRegionData, StoredLayer } from './markList.ts'
import type { ColorScaleTable } from '@jbrowse/core/util/markEncoding'

function table(values: string[], numericKeys?: boolean): ColorScaleTable {
  return {
    kind: 'categorical',
    field: 'score',
    domain: [],
    ...(numericKeys ? { numericKeys } : {}),
    entries: values.map((value, i) => ({ value, color: 0xff000000 + i })),
  }
}

function region(...scales: (ColorScaleTable | undefined)[]): MarkRegionData {
  return {
    layers: scales.map((scale): StoredLayer => ({
      count: 0,
      skipped: 0,
      x: new Uint32Array(0),
      x2: new Uint32Array(0),
      featureIndex: new Uint32Array(0),
      yMin: Infinity,
      yMax: -Infinity,
      scale,
    })),
  }
}

const TEN = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

function noteOf(scale: ColorScaleTable) {
  const [key] = markColorScales(buildMarkLegend([region(scale)]))
  return key?.kind === 'categorical' ? key.note : undefined
}

test('a numeric key past a handful of rows says the scale slot is what changes it', () => {
  expect(noteOf(table(TEN, true))).toMatch(/numeric values drawn as categories/)
})

test('a numeric key a reader can still scan carries no hint', () => {
  expect(noteOf(table(['1', '2', '3'], true))).toBeUndefined()
})

test('a long key over values that are not numbers carries no hint', () => {
  expect(noteOf(table(TEN.map(v => `type${v}`)))).toBeUndefined()
})

test('the hint needs every region to have met numbers, the union ANDing them', () => {
  const sections = buildMarkLegend([
    region(table(TEN, true)),
    region(table([...TEN, 'chrX'])),
  ])
  expect(sections[0]!.scale).toMatchObject({ numericKeys: undefined })
  const [key] = markColorScales(sections)
  expect(key?.kind === 'categorical' && key.note).toBeFalsy()
})

function thresholdTable(): ColorScaleTable {
  return {
    kind: 'threshold',
    field: 'pip',
    domain: [0.1, 0.5],
    entries: [
      { value: '< 0.1', color: 0xff111111 },
      { value: '0.1 \u2013 0.5', color: 0xff222222 },
      { value: '\u2265 0.5', color: 0xff333333 },
    ],
  }
}

test('a threshold key lists one swatch per interval, in bin order', () => {
  const [key] = markColorScales(buildMarkLegend([region(thresholdTable())]))
  expect(key?.kind).toBe('categorical')
  expect(key?.kind === 'categorical' && key.entries.map(e => e.label)).toEqual([
    '< 0.1',
    '0.1 \u2013 0.5',
    '\u2265 0.5',
  ])
})

test('two regions of one threshold declaration share a key', () => {
  const sections = buildMarkLegend([
    region(thresholdTable()),
    region(thresholdTable()),
  ])
  expect(sections).toHaveLength(1)
  expect(markColorScales(sections)).toHaveLength(1)
})

test('a colour two values hashed onto names both of them on hover', () => {
  const shared: ColorScaleTable = {
    kind: 'categorical',
    field: 'biotype',
    domain: [],
    entries: [
      { value: 'lncRNA', color: 0xff111111 },
      { value: 'snoRNA', color: 0xff111111 },
      { value: 'tRNA', color: 0xff222222 },
    ],
  }
  expect(categoryLabel(shared, 0xff111111)).toBe('lncRNA, snoRNA')
  expect(categoryLabel(shared, 0xff222222)).toBe('tRNA')
  expect(categoryLabel(shared, 0xff333333)).toBeUndefined()
  expect(categoryLabel(thresholdTable(), 0xff222222)).toBe('0.1 – 0.5')
})

function divergingRegion(values: number[]) {
  return region(
    encodeFeatures(
      values.map(
        (log2, i) =>
          new SimpleFeature({
            uniqueId: `f${i}`,
            refName: 'ctgA',
            start: i * 10,
            end: i * 10 + 5,
            log2,
          }),
      ),
      {
        color: {
          field: 'log2',
          scale: 'linear',
          ramp: ['blue', 'white', 'red'],
          domainMid: 0,
        },
      },
      ['colorValue'],
    ).scale,
  )
}

// Each region bakes its table with the middle stop placed by its own domain,
// and the union kept the first region's: white sat at 1.4 over [-0.2, 3].
test('an unpinned diverging ramp unioned over two regions keeps its middle stop at domainMid', () => {
  const [section] = buildMarkLegend([
    divergingRegion([-0.2, 0.2]),
    divergingRegion([-0.1, 3]),
  ])
  const table = section!.scale
  expect(table.kind).toBe('ramp')
  if (table.kind !== 'ramp') {
    return
  }
  const [min, max] = table.domain
  expect(min).toBeCloseTo(-0.2)
  expect(max).toBeCloseTo(3)
  const entries = table.lut.length / 4
  let whitest = 0
  for (let i = 0; i < entries; i++) {
    if (table.lut[i * 4 + 1]! > table.lut[whitest * 4 + 1]!) {
      whitest = i
    }
  }
  const valueAtWhite = min + (whitest / (entries - 1)) * (max - min)
  expect(Math.abs(valueAtWhite)).toBeLessThan((max - min) / entries)
})
