import { censusFields } from './fieldCensus.ts'
import SimpleFeature from './simpleFeature.ts'

function features(records: Record<string, unknown>[]) {
  return records.map(
    (record, i) =>
      new SimpleFeature({
        uniqueId: `f${i}`,
        refName: 'ctgA',
        start: i,
        end: i + 10,
        ...record,
      }),
  )
}

function summaryOf(
  records: Record<string, unknown>[],
  field: string,
  cap = 40,
) {
  return censusFields(features(records), cap).fields.find(
    f => f.field === field,
  )
}

test('counts the features, and lists what they carry less where they sit and what they are made of', () => {
  const { n, fields } = censusFields(
    features([
      { name: 'a', score: 5, subfeatures: [] },
      { name: 'b', score: 7 },
    ]),
    40,
  )
  expect(n).toBe(2)
  expect(fields.map(f => f.field)).toEqual(['name', 'score'])
})

test('a field counts the features carrying a value, an empty one among the lacking', () => {
  expect(
    summaryOf(
      [{ biotype: 'lncRNA' }, {}, { biotype: null }, { biotype: '' }],
      'biotype',
    ),
  ).toEqual({
    field: 'biotype',
    carried: 1,
    numeric: false,
    values: ['lncRNA'],
  })
})

test('a field is numeric only where every value reads as a number', () => {
  expect(summaryOf([{ score: 5 }, { score: '7.5' }], 'score')!.numeric).toBe(
    true,
  )
  expect(
    summaryOf([{ milliDiv: '120' }, { milliDiv: 'n/a' }], 'milliDiv')!.numeric,
  ).toBe(false)
  expect(summaryOf([{ flag: true }], 'flag')!.numeric).toBe(false)
})

test('a structured field lists its members by the path a channel reads, and a record is no value', () => {
  const { fields } = censusFields(
    features([
      {
        INFO: { DP: [31], SVTYPE: ['DEL'] },
        samples: { HG00096: { GT: ['0|1'] } },
        mate: { refName: 'ctgB', start: 5 },
      },
    ]),
    40,
  )
  expect(fields.map(f => f.field)).toEqual([
    'INFO.DP',
    'INFO.SVTYPE',
    'mate.refName',
    'mate.start',
  ])
  expect(fields[0]).toEqual({
    field: 'INFO.DP',
    carried: 1,
    numeric: true,
    values: ['31'],
  })
})

test('a list of several joins as one value and leaves the field as numeric as its single values', () => {
  expect(summaryOf([{ AF: [0.1] }, { AF: [0.2, 0.3] }], 'AF')).toEqual({
    field: 'AF',
    carried: 2,
    numeric: true,
    values: ['0.1', '0.2,0.3'],
  })
  expect(summaryOf([{ ontology: ['GO:1', 'GO:2'] }], 'ontology')).toEqual({
    field: 'ontology',
    carried: 1,
    numeric: undefined,
    values: ['GO:1,GO:2'],
  })
})

test('a field past the cap drops its values and keeps counting its features', () => {
  const records = Array.from({ length: 5 }, (_, i) => ({ name: `g${i}` }))
  expect(summaryOf(records, 'name', 5)!.values).toHaveLength(5)
  expect(summaryOf(records, 'name', 4)).toEqual({
    field: 'name',
    carried: 5,
    numeric: false,
    values: undefined,
  })
})
