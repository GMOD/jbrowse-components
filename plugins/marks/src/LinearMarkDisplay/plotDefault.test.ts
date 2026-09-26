import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { defaultPlotMarks } from './plotDefault.ts'
import { scanPlotFields } from './scanPlotFields.ts'

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

test('aligned reads draw their depth, whatever score each read carries', () => {
  const reads = scanPlotFields(
    features([
      { score: 60, flags: 99, template_length: 300 },
      { score: 0, flags: 147, template_length: -300 },
    ]),
    { listedSources: 0 },
  )
  expect(reads.reads).toBe(true)
  expect(defaultPlotMarks(reads)).toEqual([
    { mark: 'bar', transform: [{ type: 'coverage' }] },
  ])
  const peaks = scanPlotFields(features([{ score: 5 }, { score: 9 }]), {
    listedSources: 0,
  })
  expect(peaks.reads).toBeUndefined()
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

test('a paired record draws links, whichever way it names its other end', () => {
  const bedpe = scanPlotFields(
    features([
      { score: 7, mate: { refName: 'ctgB', start: 30, end: 40 } },
      { score: 9, mate: { refName: 'ctgB', start: 50, end: 60 } },
    ]),
    { listedSources: 0 },
  )
  expect(bedpe.mated).toBe('mate')
  // a score of its own does not make a paired record a bar chart
  expect(bedpe.numeric).toContain('score')
  expect(defaultPlotMarks(bedpe)).toEqual([
    { mark: 'link', transform: [{ type: 'mate' }] },
  ])

  const breakends = scanPlotFields(
    features([
      { ALT: ['N[ctgB:2000['], INFO: { SVTYPE: ['BND'] } },
      { ALT: ['<DEL>'], INFO: { END: [400] } },
    ]),
    { listedSources: 0 },
  )
  expect(breakends.mated).toBe('alt')
  expect(defaultPlotMarks(breakends)).toEqual(defaultPlotMarks(bedpe))
})

test('an ordinary VCF names no other end, so its default is what its fields say', () => {
  const snvs = scanPlotFields(
    features([
      { ALT: ['A'], QUAL: 50, score: 3 },
      { ALT: ['G'], QUAL: 20, score: 4 },
    ]),
    { listedSources: 0 },
  )
  expect(snvs.mated).toBeUndefined()
  expect(defaultPlotMarks(snvs)).toEqual([
    { mark: 'bar', encoding: { y: 'score' } },
  ])
})
