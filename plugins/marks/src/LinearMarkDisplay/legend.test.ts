import { legendSpecOf } from '@jbrowse/core/ui/colorScale'
import { legendEntries } from '@jbrowse/core/ui/legendSpec'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import {
  MISCONFIGURED_ABGR,
  NO_VALUE_ABGR,
  encodeFeatures,
} from '@jbrowse/core/util/markEncoding'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { thresholdPalette } from '@jbrowse/core/util/thresholdScale'

import { paintColors } from '../../../../packages/render-core/src/marks/markRamp.ts'
import { buildMarkLegend, categoryLabel, markColorScales } from './legend.ts'

import type { MarkRegionData, StoredLayer } from './markList.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type {
  ColorScaleTable,
  ContinuousRef,
  ShapeName,
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

test('a numeric key its breaks narrow to a handful of rows carries no hint', () => {
  const [key] = markColorScales(
    buildMarkLegend([region(table(TEN, true))], undefined, () => ({
      breaks: ['1', '5', '10'],
    })),
  )
  expect(key?.kind === 'categorical' && key.note).toBeFalsy()
  expect(rowLabels(key ? [key] : [])).toEqual([['1', '5', '10']])
})

test('a long key over values that are not numbers carries no hint', () => {
  expect(noteOf(table(TEN.map(v => `type${v}`)))).toBeUndefined()
})

test('the hint stands in for a numeric key too long to draw', () => {
  const sixty = Array.from({ length: 60 }, (_, i) => `${i}`)
  expect(
    legendEntries(
      legendSpecOf(
        markColorScales(buildMarkLegend([region(table(sixty, true))])),
      ),
    ).map(e => e.label),
  ).toEqual([
    'score',
    expect.stringMatching(/numeric values drawn as categories/),
  ])
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
    range: ['#111111', '#222222', '#333333'],
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

// The feature display's threshold key grows the same two rows once a
// value-less feature or unreadable text painted (ADR-156), in its order; a
// region that met neither leaves them out.
test('a threshold key lists every interval, and the two keyless rows once a region painted them', () => {
  const sparse: ColorScaleTable = {
    ...thresholdTable(),
    missing: true,
    notNumber: true,
  }
  const sections = buildMarkLegend([region(thresholdTable()), region(sparse)])
  expect(sections).toHaveLength(1)
  const [key] = markColorScales(sections)
  expect(
    key?.kind === 'categorical' &&
      key.entries.map(e => [e.label, e.missing ?? false]),
  ).toEqual([
    ['< 0.1', false],
    ['0.1 – 0.5', false],
    ['≥ 0.5', false],
    ['(not a number)', false],
    ['(no value)', true],
  ])
  expect(categoryLabel(sections[0]!.scale, NO_VALUE_ABGR)).toBe('(no value)')
  expect(categoryLabel(sections[0]!.scale, MISCONFIGURED_ABGR)).toBe(
    '(not a number)',
  )
  expect(categoryLabel(thresholdTable(), NO_VALUE_ABGR)).toBeUndefined()
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

const GREY = cssColorToABGR('#8c8c8c')

function lineages(
  colors = [cssColorToABGR('#4575b4'), cssColorToABGR('#fdae61'), GREY, GREY],
): ColorScaleTable {
  const values = ['AluJ', 'AluS', 'FLAM', 'FRAM']
  return {
    kind: 'categorical',
    field: 'lineage',
    domain: values,
    entries: values.map((value, i) => ({ value, color: colors[i]! })),
  }
}

function keyRows(scales: ColorScale[]) {
  return scales.flatMap(s =>
    s.kind === 'categorical' ? s.entries.map(e => [e.label, e.swatches]) : [],
  )
}

// alu_age's two fossil monomers share a grey, and the key listed two grey
// rows a reader could not tell apart.
test('two values sharing a colour are one row naming both', () => {
  expect(
    keyRows(markColorScales(buildMarkLegend([region(lineages())]))),
  ).toEqual([
    ['AluJ', undefined],
    ['AluS', undefined],
    ['FLAM, FRAM', undefined],
  ])
})

test('a key painting one colour says nothing and is not drawn', () => {
  expect(markColorScales(buildMarkLegend([region(table(['1']))]))).toEqual([])
})

function shapes(
  entries: [string, ShapeName][],
): NonNullable<StoredLayer['shapeScale']> {
  return {
    kind: 'shape',
    field: 'lineage',
    domain: [],
    entries: entries.map(([value, shape]) => ({ value, shape })),
  }
}

function withShapes(
  scale: ColorScaleTable,
  shapeScale: NonNullable<StoredLayer['shapeScale']>,
): MarkRegionData {
  const [layer] = region(scale).layers
  return { layers: [{ ...layer!, shapeScale }] }
}

test("a shared colour's row draws each shape its values take, in the colour", () => {
  const loaded = withShapes(
    lineages(),
    shapes([
      ['AluJ', 'circle'],
      ['AluS', 'circle'],
      ['FLAM', 'diamond'],
      ['FRAM', 'triangle-down'],
    ]),
  )
  const grey = 'rgba(140,140,140,1)'
  expect(keyRows(markColorScales(buildMarkLegend([loaded]))).at(-1)).toEqual([
    'FLAM, FRAM',
    [
      { color: grey, shape: 'diamond' },
      { color: grey, shape: 'triangle-down' },
    ],
  ])
})

test('a colour key with nothing to say leaves the shape key over its field standing', () => {
  const scales = markColorScales(
    buildMarkLegend([
      withShapes(
        lineages([GREY, GREY, GREY, GREY]),
        shapes([
          ['AluJ', 'circle'],
          ['FLAM', 'diamond'],
        ]),
      ),
    ]),
  )
  expect(scales.map(s => s.id)).toEqual(['mark-0-shape'])
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

// A ramp's key lists the no-value and not-a-number rows beside its bar once any
// region painted one, as a threshold's key does.
test('a ramp key lists what it painted grey, across the regions', () => {
  const scales = markColorScales(
    buildMarkLegend([rampRegion([1, 2, null]), rampRegion([3, 'n/a'])]),
  )
  expect(scales.map(s => s.kind)).toEqual(['ramp', 'categorical'])
  expect(scales[1]).toMatchObject({
    entries: [
      { value: '(not a number)' },
      { value: '', label: '(no value)', missing: true },
    ],
  })
  expect(
    markColorScales(buildMarkLegend([rampRegion([1, 2])])).map(s => s.kind),
  ).toEqual(['ramp'])
})

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
    range: ['#111112', '#222223', '#333334'],
  }
  const sections = buildMarkLegend([region(thresholdTable(), recoloured)])
  expect(sections).toHaveLength(2)
  expect(categoryLabel(sections[1]!.scale, cssColorToABGR('#222223'))).toBe(
    '0.1 – 0.5',
  )
})

// A ramp with an open end follows each mark's own loaded values, so it stays
// that mark's; pinned at both ends there is nothing left to follow, and the
// declaration is the key, as a categorical one's is.
// A key is the scale as resolved, so a declaration spelling the default out
// and one leaving it unset are one key.
test('a key compares the resolved ramp or palette, not its spelling', () => {
  const pinned = { domainMin: 0, domainMax: 100 }
  const scaleOf = (color: Partial<ContinuousRef>) =>
    rampRegion([10, 20], color).layers[0]!.scale
  expect(
    buildMarkLegend([
      region(scaleOf(pinned), scaleOf({ ...pinned, scheme: 'viridis' })),
    ]),
  ).toHaveLength(1)
  const spelt: ColorScaleTable = {
    ...thresholdTable(),
    range: thresholdPalette(3),
  }
  const unspelt: ColorScaleTable = { ...thresholdTable(), range: undefined }
  expect(buildMarkLegend([region(spelt, unspelt)])).toHaveLength(1)
})

test('two marks declaring one ramp pinned at both ends share a key, and open ramps stay per mark', () => {
  const pinned = { domainMin: 0, domainMax: 100, range: ['white', 'red'] }
  const scaleOf = (values: number[], color: Partial<ContinuousRef>) =>
    rampRegion(values, color).layers[0]!.scale
  expect(
    buildMarkLegend([
      region(scaleOf([10, 20], pinned), scaleOf([30, 40], pinned)),
    ]),
  ).toMatchObject([{ markIndexes: [0, 1] }])
  expect(
    buildMarkLegend([
      region(
        scaleOf([10, 20], pinned),
        scaleOf([30, 40], { ...pinned, range: ['white', 'blue'] }),
      ),
    ]),
  ).toHaveLength(2)
  expect(
    buildMarkLegend([region(scaleOf([10, 20], {}), scaleOf([10, 20], {}))]),
  ).toHaveLength(2)
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
  expect(table.domain[0]).toBeCloseTo(-0.2)
  expect(table.domain[1]).toBeCloseTo(3)
  // what both backends paint through: the straight table and the middle
  const colors = paintColors(
    { colorValue: Float32Array.of(0, -0.2, 0.2, 3) },
    4,
    {
      domain: table.domain,
      scale: table.scale,
      lut: table.lut,
      mid: table.domainMid,
    },
  )
  const [white, below, above, far] = Array.from(colors, abgr => [
    abgr & 255,
    (abgr >>> 8) & 255,
    (abgr >>> 16) & 255,
  ])
  for (const channel of white!) {
    expect(channel).toBeGreaterThanOrEqual(254)
  }
  // equal distances either side of the middle take mirrored colours, and only
  // the farther end reaches its end stop
  expect(below).toEqual([...above!].reverse())
  expect(below![2]).toBe(255)
  expect(below![0]).toBeLessThan(255)
  expect(far).toEqual([255, 0, 0])
})

// A backend re-uploads a ramp on identity, and the key is rebuilt whenever a
// region lands; a domain that widens under a declared middle moves where the
// middle is read, not the table.
test('a key rebuilt over a widened extent hands back the same table', () => {
  const regions = [divergingRegion([-0.2, 0.2]), divergingRegion([-0.1, 3])]
  const lutOf = (loaded: MarkRegionData[]) => {
    const { scale } = buildMarkLegend(loaded)[0]!
    return scale.kind === 'ramp' ? scale.lut : undefined
  }
  const first = lutOf(regions)
  expect(first).toBeDefined()
  expect(lutOf(regions)).toBe(first)
  expect(lutOf([...regions, divergingRegion([-1, 0.5])])).toBe(first)
})

function keyTitle(written: string | undefined, loaded: MarkRegionData) {
  const [key] = markColorScales(
    buildMarkLegend([loaded], undefined, () => ({ title: written })),
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
          buildMarkLegend([region(table(['1', '2']))], undefined, () => ({
            title: written,
          })),
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
    buildMarkLegend([both], undefined, i => ({ title: titleOf(i) })).map(
      s => s.title,
    )
  expect(keys(() => 'MAPQ')).toEqual(['MAPQ'])
  expect(keys(i => (i === 0 ? 'score' : undefined))).toEqual(['score'])
  expect(keys(i => (i === 0 ? 'MAPQ' : undefined))).toEqual(['MAPQ', 'score'])
})

test('a key names a domain value by the label the colour lists for it', () => {
  const labelled: ColorScaleTable = {
    kind: 'categorical',
    field: 'type',
    domain: ['DEL', 'DUP'],
    labels: ['Loss', 'Gain'],
    entries: [
      { value: 'DEL', color: 0xff0000ff },
      { value: 'DUP', color: 0xffff0000 },
      { value: 'INV', color: 0xff00ff00 },
    ],
  }
  const [key] = markColorScales(buildMarkLegend([region(labelled)]))
  expect(key?.kind === 'categorical' && key.entries.map(e => e.label)).toEqual([
    'Loss',
    'Gain',
    'INV',
  ])
})

const shapeRegion = (values: [string, ShapeName][]): MarkRegionData => ({
  layers: [
    {
      count: 0,
      skipped: 0,
      x: new Uint32Array(0),
      x2: new Uint32Array(0),
      featureIndex: new Uint32Array(0),
      yMin: Infinity,
      yMax: -Infinity,
      shapeScale: {
        kind: 'shape',
        field: 'ld_role',
        domain: ['index', 'partner'],
        entries: values.map(([value, shape]) => ({ value, shape })),
      },
    },
  ],
})

function rowLabels(scales: ColorScale[]) {
  return scales.map(s =>
    s.kind === 'categorical' ? s.entries.map(e => e.label) : [],
  )
}

// LocusZoom's key, from the grammar: the r² bins highest first ending in the
// row it names, and the diamond alone in a key of its own.
test('a key lists the values its breaks name, highest first where it descends, and names its no-value row', () => {
  const r2: ColorScaleTable = { ...thresholdTable(), missing: true }
  expect(
    rowLabels(
      markColorScales(
        buildMarkLegend([region(r2)], undefined, () => ({
          descending: true,
          missingLabel: 'No LD data',
        })),
      ),
    ),
  ).toEqual([['≥ 0.5', '0.1 – 0.5', '< 0.1', 'No LD data']])

  const roles = shapeRegion([
    ['index', 'diamond'],
    ['partner', 'circle'],
    ['', 'circle'],
  ])
  expect(
    rowLabels(
      markColorScales(
        buildMarkLegend([roles], undefined, () => ({
          breaks: ['index'],
          labels: ['Index SNP'],
        })),
      ),
    ),
  ).toEqual([['Index SNP']])
  expect(
    rowLabels(
      markColorScales(
        buildMarkLegend([roles], undefined, () => ({
          missingLabel: 'unjoined',
        })),
      ),
    ),
  ).toEqual([['index', 'partner', 'unjoined']])
})

test('a categorical colour key lists its breaks in their order', () => {
  expect(
    rowLabels(
      markColorScales(
        buildMarkLegend([region(table(['1', '2', '3']))], undefined, () => ({
          breaks: ['3', '1'],
        })),
      ),
    ),
  ).toEqual([['3', '1']])
})

// As ggplot2 draws a layer's key glyphs in the layer's fixed aesthetics.
test('a shape key draws its shapes in the one colour its mark paints, and in the text colour otherwise', () => {
  const [layer] = shapeRegion([['index', 'diamond']]).layers
  const twoMarks = { layers: [layer!, layer!] }
  const swatches = (colors: (string | undefined)[]) =>
    markColorScales(
      buildMarkLegend([twoMarks], undefined, i => ({
        swatchColor: colors[i],
      })),
    ).map(s =>
      s.kind === 'categorical' ? s.entries.flatMap(e => e.swatches) : [],
    )
  expect(swatches(['#c951c9', '#c951c9'])).toEqual([
    [{ color: '#c951c9', shape: 'diamond' }],
  ])
  expect(swatches([undefined, undefined])).toEqual([
    [{ color: 'currentColor', shape: 'diamond' }],
  ])
  expect(swatches(['red', 'blue'])).toEqual([
    [{ color: 'red', shape: 'diamond' }],
    [{ color: 'blue', shape: 'diamond' }],
  ])
})
