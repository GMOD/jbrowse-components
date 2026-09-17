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

test('a string facet is a field, and a string color is a constant', () => {
  expect(parse({ facet: 'strand', color: 'red' })).toEqual({
    facet: { field: 'strand' },
    color: 'red',
  })
})

test("the mark display's categorical color parses to the scale it names", () => {
  expect(
    parse({
      color: {
        field: 'strand',
        scale: 'categorical',
        domain: ['-1', '1'],
        palette: ['blue', 'red'],
      },
    }),
  ).toEqual({
    color: { field: 'strand', domain: ['-1', '1'], palette: ['blue', 'red'] },
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
  [{ facet: { field: 'x', domain: 'a' } }, 'facet.domain is a list'],
  [{ color: { field: 'x', value: 'red' } }, 'not value'],
  [{ color: {} }, 'color.field names a field'],
  [{ color: { field: 'x', scale: 'linear' } }, 'color.scale is categorical'],
  [{ color: { field: 'x', palette: 'red' } }, 'color.palette is a list'],
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
