import { channelSpecChanges, parseChannelSpec } from './channelSpec.ts'

const parse = (spec: unknown) => parseChannelSpec(JSON.stringify(spec))

test('the plugin request, as a spec', () => {
  expect(
    parse({
      facet: { field: 'subtrack', domain: ['key5', 'key2', 'key3'] },
      color: { field: 'subtrack' },
    }),
  ).toEqual({
    facet: { field: 'subtrack', domain: ['key5', 'key2', 'key3'] },
    color: { field: 'subtrack' },
  })
})

test('a field name alone is the shorthand for facet and color', () => {
  expect(parse({ facet: 'strand', color: 'gene_biotype' })).toEqual({
    facet: { field: 'strand' },
    color: { field: 'gene_biotype' },
  })
})

test('a channel left out stays out, and null is kept to clear one', () => {
  expect(parse({ filter: null })).toEqual({ filter: null })
  expect(parse({})).toEqual({})
})

test('a single filter reads as a list of one', () => {
  expect(parse({ filter: "feature.type == 'gene'" })).toEqual({
    filter: ["feature.type == 'gene'"],
  })
})

test('a numeric domain value is the string a group key is', () => {
  expect(parse({ facet: { field: 'HP', domain: [2, 1] } })).toEqual({
    facet: { field: 'HP', domain: ['2', '1'] },
  })
})

test.each([
  [{ group: 'x' }, 'The channels are facet, color and filter, not group'],
  [{ facet: { field: '' } }, 'facet.field names a field'],
  [
    { facet: { field: 'x', order: [] } },
    'facet takes field and domain, not order',
  ],
  [{ facet: { field: 'x', domain: 'a' } }, 'facet.domain lists values'],
  [
    { color: { field: 'x', value: 'red' } },
    'color takes one of field and value',
  ],
  [{ color: {} }, 'color takes one of field and value'],
  [{ filter: [1] }, 'filter is a jexl expression'],
])('%j is refused: %s', (spec, message) => {
  expect(() => parse(spec)).toThrow(message)
})

test('a spec that is not one object is refused', () => {
  expect(() => parseChannelSpec('[]')).toThrow('one JSON object')
})

test('changes are what differs from the current channels', () => {
  const current = {
    facet: { field: 'strand' },
    color: null,
    filter: ["feature.type == 'gene'"],
  }
  expect(
    channelSpecChanges(
      {
        facet: { field: 'strand' },
        color: { field: 'strand' },
        filter: null,
      },
      current,
    ),
  ).toEqual({ sets: ['color'], clears: ['filter'] })
})
