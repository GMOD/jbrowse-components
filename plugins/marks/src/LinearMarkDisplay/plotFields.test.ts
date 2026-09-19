import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import {
  BINNED_BP_PER_PX,
  defaultPlotMarks,
  plotMarks,
  scanPlotFields,
  specOfMarks,
} from './plotFields.ts'

import type { MarkColorScale } from './configSchema.ts'

function features(recs: Record<string, unknown>[]) {
  return recs.map(
    (r, i) =>
      new SimpleFeature({
        uniqueId: `f${i}`,
        refName: 'ctgA',
        start: 0,
        end: 10,
        ...r,
      }),
  )
}

test('a field is numeric only where every value it carries reads as a number', () => {
  const fields = scanPlotFields(
    features([
      { score: 5, milliDiv: '120', repClass: 'Alu', strand: 1 },
      { score: 7, milliDiv: 'n/a', repClass: 'L1', strand: -1 },
    ]),
  )
  expect(fields.numeric).toEqual(['score'])
  // milliDiv reads as text in one row, and strand is a code
  expect(fields.categorical).toEqual(['milliDiv', 'repClass', 'strand'])
})

test('the default is a bar of score, and nothing where the features carry none', () => {
  expect(
    defaultPlotMarks({ numeric: ['score', 'qual'], categorical: [] }),
  ).toEqual([{ shape: 'bar', encoding: { y: 'score' } }])
  expect(
    defaultPlotMarks({ numeric: ['qual'], categorical: ['name'] }),
  ).toBeUndefined()
})

test('features from more than one source name source as the facet field', () => {
  const multi = scanPlotFields(
    features([
      { score: 5, source: 'k1' },
      { score: 7, source: 'k2' },
    ]),
  )
  expect(multi.facet).toBe('source')
  expect(defaultPlotMarks(multi)).toEqual([
    { shape: 'bar', encoding: { y: 'score' } },
  ])
  const single = scanPlotFields(
    features([
      { score: 5, source: 'k1' },
      { score: 7, source: 'k1' },
    ]),
  )
  expect(single.facet).toBeUndefined()
  expect(defaultPlotMarks(single)).toEqual([
    { shape: 'bar', encoding: { y: 'score' } },
  ])
})

test('a colour field takes a palette or a ramp by what it holds', () => {
  const fields = { numeric: ['score', 'depth'], categorical: ['repClass'] }
  expect(
    plotMarks(
      { field: 'score', shape: 'point', colorField: 'repClass', binned: false },
      fields,
    ),
  ).toEqual([
    {
      shape: 'point',
      encoding: {
        y: 'score',
        color: { field: 'repClass', scale: 'categorical' },
      },
    },
  ])
  expect(
    plotMarks(
      { field: 'score', shape: 'bar', colorField: 'depth', binned: false },
      fields,
    )[0]!.encoding.color,
  ).toEqual({ field: 'depth', scale: 'linear' })
})

test('the binned box adds a zoom-following count and hands the axis over', () => {
  const marks = plotMarks(
    { field: 'score', shape: 'bar', colorField: '', binned: true },
    { numeric: ['score'], categorical: [] },
  )
  expect(marks[0]).toEqual({
    shape: 'bar',
    encoding: { y: 'score' },
    maxBpPerPx: BINNED_BP_PER_PX,
  })
  expect(marks[1]).toEqual({
    shape: 'bar',
    transform: [
      { type: 'bin', step: 'auto' },
      { type: 'aggregate', groupby: ['start', 'end'], ops: [{ op: 'count' }] },
    ],
    encoding: { y: 'count' },
    minBpPerPx: BINNED_BP_PER_PX,
  })
})

function markLike(
  shape: string,
  y: string,
  color = '',
  transform: { type: string }[] = [],
  colorScale?: MarkColorScale,
  extras: { domain?: string[]; palette?: string[]; ramp?: string[] } = {},
) {
  return {
    shape,
    encoding: {
      y,
      color: {
        field: color,
        scale: colorScale,
        domain: extras.domain ?? [],
        palette: extras.palette ?? [],
        ramp: extras.ramp ?? [],
      },
    },
    transform,
  }
}

test('a single-mark config reopens the dialog on what it declared', () => {
  expect(specOfMarks([markLike('point', 'score', 'repClass')])).toEqual({
    field: 'score',
    shape: 'point',
    colorField: 'repClass',
    binned: false,
    colorScale: {
      field: 'repClass',
      scale: undefined,
      domain: [],
      palette: [],
      ramp: [],
    },
  })
  expect(
    specOfMarks([
      markLike('bar', 'score'),
      markLike('bar', 'count', '', [{ type: 'bin' }]),
    ])?.binned,
  ).toBe(true)
})

test('a colour field kept under the none scale reopens as no colour', () => {
  const spec = specOfMarks([markLike('point', 'score', 'repClass', [], 'none')])
  expect(spec?.colorField).toBe('')
  expect(spec?.colorScale).toBeUndefined()
})

// The dialog offers a field and a shape; the domain, palette and ramp beside
// them are the config author's, and a save used to drop all three.
test('a reopened colour carries the members the dialog does not ask about', () => {
  const declared = markLike('bar', 'score', 'depth', [], 'log', {
    domain: ['1', '1000'],
    ramp: ['white', 'red'],
  })
  const spec = specOfMarks([declared])!
  expect(
    plotMarks(spec, { numeric: ['score', 'depth'], categorical: [] })[0]!
      .encoding.color,
  ).toEqual({
    field: 'depth',
    scale: 'log',
    domain: ['1', '1000'],
    ramp: ['white', 'red'],
  })
  // another field starts from neither
  expect(
    plotMarks(
      { ...spec, colorField: 'score' },
      { numeric: ['score', 'depth'], categorical: [] },
    )[0]!.encoding.color,
  ).toEqual({ field: 'score', scale: 'linear' })
})

test('a config the dialog could not have written reopens empty', () => {
  expect(specOfMarks([])).toBeUndefined()
  expect(specOfMarks([markLike('span', '')])).toBeUndefined()
  expect(
    specOfMarks([markLike('bar', 'depth', '', [{ type: 'coverage' }])]),
  ).toBeUndefined()
  expect(
    specOfMarks([
      markLike('bar', 'score'),
      markLike('bar', 'score'),
      markLike('bar', 'score'),
    ]),
  ).toBeUndefined()
})
