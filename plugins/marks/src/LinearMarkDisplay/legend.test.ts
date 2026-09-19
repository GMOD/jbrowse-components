import { buildMarkLegend, markColorScales } from './legend.ts'

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
