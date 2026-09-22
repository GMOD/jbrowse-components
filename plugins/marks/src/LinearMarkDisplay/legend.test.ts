import { legendSpecOf } from '@jbrowse/core/ui/colorScale'
import { legendEntries } from '@jbrowse/core/ui/legendSpec'
import { encodeFeatures } from '@jbrowse/core/util/markEncoding'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { buildMarkLegend, categoryLabel, markColorScales } from './legend.ts'

import type { MarkRegionData, StoredLayer } from './markList.ts'
import type {
  ColorScaleTable,
  ContinuousRef,
} from '@jbrowse/core/util/markEncoding'

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

function thresholdTable(): Extract<ColorScaleTable, { kind: 'threshold' }> {
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

function rampRegion(values: unknown[], color: Partial<ContinuousRef> = {}) {
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
      { color: { field: 'log2', scale: 'linear', ...color } },
      ['colorValue'],
    ).scale,
  )
}

function divergingRegion(values: number[]) {
  return rampRegion(values, {
    range: ['blue', 'white', 'red'],
    domainMid: 0,
  })
}

function keyDomain(regions: MarkRegionData[]) {
  const table = buildMarkLegend(regions)[0]?.scale
  return table?.kind === 'ramp' ? table.domain : undefined
}

// A sparse region used to contribute [0, 1] to the union, so a ramp over
// [100, 1000] became [0, 1000] once one loaded.
test('a region holding no number leaves an open ramp where the others put it', () => {
  expect(keyDomain([rampRegion([100, 1000]), rampRegion([])])).toEqual([
    100, 1000,
  ])
  expect(keyDomain([rampRegion(['none']), rampRegion([100, 1000])])).toEqual([
    100, 1000,
  ])
  expect(keyDomain([rampRegion([]), rampRegion(['none'])])).toEqual([0, 1])
})

test('a pinned floor holds across the union, and the open ceiling widens to it', () => {
  expect(
    keyDomain([
      rampRegion([10, 20], { domainMin: 0 }),
      rampRegion([15, 90], { domainMin: 0 }),
    ]),
  ).toEqual([0, 90])
})

test('two threshold marks over one field and cuts keep a key each when their ranges differ', () => {
  const recoloured: ColorScaleTable = {
    ...thresholdTable(),
    entries: thresholdTable().entries.map(e => ({
      ...e,
      color: e.color + 1,
    })),
  }
  const sections = buildMarkLegend([region(thresholdTable(), recoloured)])
  expect(sections).toHaveLength(2)
  expect(categoryLabel(sections[1]!.scale, 0xff222223)).toBe('0.1 – 0.5')
})

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

// A backend re-uploads a ramp on identity, and the key is rebuilt whenever a
// region lands.
test('a key rebuilt over an extent that has not moved hands back the table it baked', () => {
  const regions = [divergingRegion([-0.2, 0.2]), divergingRegion([-0.1, 3])]
  const lutOf = (loaded: MarkRegionData[]) => {
    const { scale } = buildMarkLegend(loaded)[0]!
    return scale.kind === 'ramp' ? scale.lut : undefined
  }
  const first = lutOf(regions)
  expect(first).toBeDefined()
  expect(lutOf(regions)).toBe(first)
  expect(lutOf([...regions, divergingRegion([-1, 0.5])])).not.toBe(first)
})

function keyTitle(written: string | undefined, loaded: MarkRegionData) {
  const [key] = markColorScales(
    buildMarkLegend([loaded], undefined, () => written),
  )
  return key?.title
}

// Unset derives, text is the text, and the empty string is a key the author
// wants bare, the three states `scales.y.title` has.
test('a colour key is titled with its field until title names it, and "" leaves it bare', () => {
  const scores = region(table(['1', '2']))
  expect(keyTitle(undefined, scores)).toBe('score')
  expect(keyTitle('Mapping quality', scores)).toBe('Mapping quality')
  expect(keyTitle('', scores)).toBeUndefined()
  expect(keyTitle('PIP', region(thresholdTable()))).toBe('PIP')
  expect(keyTitle(undefined, rampRegion([1, 2]))).toBe('log2')
  expect(keyTitle('log2 ratio', rampRegion([1, 2]))).toBe('log2 ratio')
  expect(keyTitle('', rampRegion([1, 2]))).toBeUndefined()
})

test('a bare key leaves the legend no heading row', () => {
  const heading = (written: string | undefined) =>
    legendEntries(
      legendSpecOf(
        markColorScales(
          buildMarkLegend(
            [region(table(['1', '2']))],
            undefined,
            () => written,
          ),
        ),
      ),
    ).map(e => e.label)
  expect(heading('Mapping quality')).toEqual(['Mapping quality', '1', '2'])
  expect(heading(undefined)).toEqual(['score', '1', '2'])
  expect(heading('')).toEqual(['1', '2'])
})

test('two marks over one declaration share a key only under one title', () => {
  const both = region(table(['1']), table(['1']))
  const keys = (titleOf: (markIndex: number) => string | undefined) =>
    buildMarkLegend([both], undefined, titleOf).map(s => s.title)
  expect(keys(() => 'MAPQ')).toEqual(['MAPQ'])
  expect(keys(i => (i === 0 ? 'score' : undefined))).toEqual(['score'])
  expect(keys(i => (i === 0 ? 'MAPQ' : undefined))).toEqual(['MAPQ', 'score'])
})
