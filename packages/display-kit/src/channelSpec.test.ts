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

test('a color object is the field with its order and palette, and a lifted constant reads back as the string', () => {
  expect(
    parse({
      color: { field: 'strand', domain: [-1, 1], palette: ['blue', 'red'] },
    }),
  ).toEqual({
    color: { field: 'strand', domain: ['-1', '1'], palette: ['blue', 'red'] },
  })
  expect(parse({ color: { value: 'red' } })).toEqual({ color: 'red' })
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

// The object checks are the config objects' own (`normalizeFacet`, `normalizeColor`),
// so what the box refuses is what a config file cannot hold either.
test.each([
  [{ group: 'x' }, 'The channels are facet, color and filter, not group'],
  [{ facet: { field: '' } }, 'facet is a field name'],
  [{ facet: {} }, 'facet is a field name'],
  [
    { facet: { field: 'x', order: [] } },
    'Facet takes field and domain, not order',
  ],
  [{ facet: { field: 'x', domain: 'a' } }, 'facet.domain is a list'],
  [{ facet: { domain: ['a'] } }, 'facet.domain orders the sections of a field'],
  [{ color: {} }, 'color is a CSS color'],
  [{ color: '' }, 'color is a CSS color'],
  [
    { color: { field: 'x', scale: 'categorical' } },
    'FeatureColor takes value, field, domain and palette, not scale',
  ],
  [{ color: { field: 'x', palette: 'red' } }, 'color.palette is a list'],
  [{ color: { palette: ['red'] } }, 'color.palette scales a field'],
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
