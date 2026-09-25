import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { configSchemaFactory } from './configSchema.ts'
import {
  BINNED_BP_PER_PX,
  defaultPlotMarks,
  plotMarks,
  specOfMarks,
} from './plotFields.ts'
import { scanPlotFields } from './scanPlotFields.ts'

import type { MarkSnapshot } from './plotFields.ts'

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
    { listedSources: 0 },
  )
  expect(fields.numeric).toEqual(['score'])
  // milliDiv reads as text in one row, and strand is a code
  expect(fields.categorical).toEqual(['milliDiv', 'repClass', 'strand'])
})

test('the default is a bar of score, and nothing where the features carry none', () => {
  expect(
    defaultPlotMarks({ numeric: ['score', 'qual'], categorical: [] }),
  ).toEqual([{ mark: 'bar', encoding: { y: 'score' } }])
  expect(
    defaultPlotMarks({ numeric: ['qual'], categorical: ['name'] }),
  ).toBeUndefined()
})

test('an adapter listing more than one source names source as the rows field, whatever the sample holds', () => {
  const multi = scanPlotFields(
    features([
      { score: 5, source: 'k1' },
      { score: 7, source: 'k1' },
    ]),
    { listedSources: 2 },
  )
  expect(multi.rows).toBe('source')
  expect(defaultPlotMarks(multi)).toEqual([
    { mark: 'bar', encoding: { y: 'score' } },
  ])
  const single = scanPlotFields(
    features([
      { score: 5, source: 'k1' },
      { score: 7, source: 'k1' },
    ]),
    { listedSources: 1 },
  )
  expect(single.rows).toBeUndefined()
  expect(defaultPlotMarks(single)).toEqual([
    { mark: 'bar', encoding: { y: 'score' } },
  ])
})

test('a score most features lack is offered but draws no default plot', () => {
  const fields = scanPlotFields(
    features([{ score: 5 }, { name: 'a' }, { name: 'b' }]),
    { listedSources: 0 },
  )
  expect(fields.numeric).toEqual(['score'])
  expect(fields.sparse).toEqual(['score'])
  expect(defaultPlotMarks(fields)).toBeUndefined()
})

test("a GFF3 record's source column is a colour field, not a facet", () => {
  const fields = scanPlotFields(
    features([
      { score: 5, source: 'est' },
      { score: 7, source: 'exonerate' },
    ]),
    { listedSources: 0 },
  )
  expect(fields.rows).toBeUndefined()
  expect(fields.categorical).toEqual(['source'])
})

test('a structured field offers its members by the path a channel reads', () => {
  const fields = scanPlotFields(
    features([
      {
        QUAL: 50,
        INFO: { DP: [31], SVTYPE: ['DEL'], AF: [0.1, 0.2], IMPRECISE: true },
        samples: { HG00096: { GT: ['0|1'] } },
      },
      {
        QUAL: 20,
        INFO: { DP: [12], SVTYPE: ['INS'], AF: [0.3, 0.4] },
        samples: { HG00096: { GT: ['1|1'] } },
      },
    ]),
    { listedSources: 0 },
  )
  expect(fields.numeric).toEqual(['INFO.DP', 'QUAL'])
  expect(fields.categorical).toEqual(['INFO.IMPRECISE', 'INFO.SVTYPE'])
})

test('a text field with more values than a colour key names is no colour choice', () => {
  const fields = scanPlotFields(
    features(
      Array.from({ length: 30 }, (_, i) => ({
        score: i,
        seq: `ACGT${i}`,
        tags: { RG: i % 2 ? 'lib1' : 'lib2', MD: `${i}A` },
      })),
    ),
    { listedSources: 0 },
  )
  expect(fields.categorical).toEqual(['tags.RG'])
})

test('a colour field takes a categorical or a linear scale by what it holds', () => {
  const fields = { numeric: ['score', 'depth'], categorical: ['repClass'] }
  expect(
    plotMarks(
      { field: 'score', mark: 'point', colorField: 'repClass', binned: false },
      fields,
    ),
  ).toEqual([
    {
      mark: 'point',
      encoding: {
        y: 'score',
        color: { field: 'repClass', scale: 'categorical' },
      },
    },
  ])
  expect(
    plotMarks(
      { field: 'score', mark: 'bar', colorField: 'depth', binned: false },
      fields,
    )[0]!.encoding!.color,
  ).toEqual({ field: 'depth', scale: 'linear' })
})

test('the binned box adds a zoom-following count and hands the axis over', () => {
  const marks = plotMarks(
    { field: 'score', mark: 'bar', colorField: '', binned: true },
    { numeric: ['score'], categorical: [] },
  )
  expect(marks[0]).toEqual({
    mark: 'bar',
    encoding: { y: 'score' },
    maxBpPerPx: BINNED_BP_PER_PX,
  })
  expect(marks[1]).toEqual({
    mark: 'bar',
    transform: [
      { type: 'bin', step: 'auto' },
      { type: 'aggregate', groupby: ['start', 'end'], ops: [{ op: 'count' }] },
    ],
    encoding: { y: 'count' },
    minBpPerPx: BINNED_BP_PER_PX,
  })
})

const schema = configSchemaFactory()

function canonical(marks: readonly MarkSnapshot[]) {
  return getSnapshot(
    schema.create({ type: 'LinearMarkDisplay', displayId: 'test', marks })
      .marks,
  )
}

function specOf(marks: MarkSnapshot[]) {
  return specOfMarks(canonical(marks) as MarkSnapshot[], canonical)
}

const FIELDS = { numeric: ['score', 'depth'], categorical: ['repClass'] }

test('a config the dialog wrote reopens on the spec that wrote it', () => {
  for (const spec of [
    { field: 'score', mark: 'point', colorField: 'repClass', binned: false },
    { field: 'score', mark: 'bar', colorField: 'depth', binned: true },
    { field: 'score', mark: 'bar', colorField: '', binned: true },
  ] as const) {
    expect(specOf(plotMarks(spec, FIELDS))).toMatchObject(spec)
  }
})

test('a colour field kept under the none scale reopens as no colour, and a save keeps it', () => {
  const declared: MarkSnapshot[] = [
    {
      mark: 'point',
      encoding: { y: 'score', color: { field: 'repClass', scale: 'none' } },
    },
  ]
  const spec = specOf(declared)!
  expect(spec.colorField).toBe('')
  expect(canonical(plotMarks(spec, FIELDS))).toEqual(canonical(declared))
})

// The dialog offers a field and a mark; every other member of the colour is
// the config author's, and a save used to drop them one slot at a time.
test('a reopened colour carries the members the dialog does not ask about', () => {
  const color = {
    field: 'depth',
    scale: 'linear' as const,
    domainMin: -2,
    domainMax: 6,
    range: ['blue', 'white', 'red'],
    domainMid: 0,
  }
  const spec = specOf([{ mark: 'bar', encoding: { y: 'score', color } }])!
  expect(plotMarks(spec, FIELDS)[0]!.encoding!.color).toEqual(color)
  expect(
    plotMarks({ ...spec, colorField: 'score' }, FIELDS)[0]!.encoding!.color,
  ).toEqual({ field: 'score', scale: 'linear' })
})

test('a constant colour survives a save that picks no colour field', () => {
  const declared = [
    { mark: 'bar', encoding: { y: 'score', color: 'steelblue' } },
  ]
  const spec = specOf(declared)!
  expect(spec.colorField).toBe('')
  expect(canonical(plotMarks(spec, FIELDS))).toEqual(canonical(declared))
})

test('a config saying more than the dialog can write back reopens empty', () => {
  const plot = { mark: 'bar', encoding: { y: 'score' } }
  const unreadable: MarkSnapshot[][] = [
    [],
    [{ mark: 'span', encoding: {} }],
    [{ ...plot, transform: [{ type: 'coverage' }] }],
    [plot, plot, plot],
    [{ mark: 'point', encoding: { y: 'score', shape: { field: 'svtype' } } }],
    [{ mark: 'bar', encoding: { y: 'score', x: 'thickStart' } }],
    [{ ...plot, maxBpPerPx: 50 }],
    [{ ...plot, source: 'density' }],
    [
      { ...plot, maxBpPerPx: BINNED_BP_PER_PX },
      {
        mark: 'bar',
        transform: [
          { type: 'bin', step: 10000 },
          { type: 'aggregate', ops: [{ op: 'count' }] },
        ],
        encoding: { y: 'count' },
        minBpPerPx: BINNED_BP_PER_PX,
      },
    ],
  ]
  for (const marks of unreadable) {
    expect(specOf(marks)).toBeUndefined()
  }
})
