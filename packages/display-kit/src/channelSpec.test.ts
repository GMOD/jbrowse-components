import {
  channelSpecChanges,
  colorSpecProblems,
  parseChannelSpec,
} from './channelSpec.ts'

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

test('a color object is the field with its order and range, and a lifted constant reads back as the string', () => {
  expect(
    parse({
      color: { field: 'strand', domain: [-1, 1], range: ['blue', 'red'] },
    }),
  ).toEqual({
    color: { field: 'strand', domain: ['-1', '1'], range: ['blue', 'red'] },
  })
  expect(parse({ color: { value: 'red' } })).toEqual({ color: 'red' })
})

test('a color object carries the members of a continuous scale through', () => {
  expect(
    parse({
      color: {
        field: 'score',
        scale: 'linear',
        domainMin: 0,
        domainMax: 10,
        domainMid: 2,
        range: ['blue', 'white', 'red'],
        reverse: true,
      },
    }),
  ).toEqual({
    color: {
      field: 'score',
      scale: 'linear',
      domainMin: 0,
      domainMax: 10,
      domainMid: 2,
      range: ['blue', 'white', 'red'],
      reverse: true,
    },
  })
  expect(
    parse({ color: { field: 'score', scale: 'log', scheme: 'viridis' } }),
  ).toEqual({ color: { field: 'score', scale: 'log', scheme: 'viridis' } })
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

// The key and list checks are the config objects' own (`closed`,
// `normalizeChannel`); the box also wants the field or colour a spec is for,
// where a config may keep an order waiting on one.
test.each([
  [{ group: 'x' }, 'The channels are facet, color and filter, not group'],
  [{ facet: { field: '' } }, 'facet is a field name'],
  [{ facet: {} }, 'facet is a field name'],
  [
    { facet: { field: 'x', order: [] } },
    'Facet takes field and domain, not order',
  ],
  [{ facet: { field: 'x', domain: 'a' } }, 'facet.domain is a list'],
  [{ facet: { domain: ['a'] } }, 'facet is a field name'],
  [{ color: {} }, 'color is a CSS color'],
  [{ color: '' }, 'color is a CSS color'],
  [{ color: { field: 'x', scale: 'none' } }, 'color is a CSS color'],
  [
    { color: { field: 'x', palette: ['red'] } },
    'color takes value, field, scale, domain, range, scheme, reverse, domainMin, domainMax, domainMid, not palette',
  ],
  [
    { color: { field: 'x', scale: 'linear', domainMid: 'mid' } },
    'color.domainMid is a number',
  ],
  [
    { color: { field: 'x', scale: 'linear', domainMin: 'low' } },
    'color.domainMin is a number',
  ],
  [
    { color: { field: 'x', scale: 'linear', reverse: 'yes' } },
    'color.reverse is true or false',
  ],
  [{ color: { field: 'x', range: 'red' } }, 'color.range is a list'],
  [{ color: { range: ['red'] } }, 'color is a CSS color'],
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

test('a scale the display does not paint is a problem, and so is a member it does not declare', () => {
  const members = ['value', 'field', 'scale', 'domain', 'range']
  const threshold = parse({ color: { field: 'score', scale: 'threshold' } })
  expect(
    colorSpecProblems(threshold, {
      scales: ['categorical', 'threshold'],
      members,
    }),
  ).toEqual([])
  expect(
    colorSpecProblems(threshold, { scales: ['categorical'], members }),
  ).toEqual(['color: this display paints categorical, not threshold'])
  const ramped = parse({ color: { field: 'score', scheme: 'viridis' } })
  expect(
    colorSpecProblems(ramped, { scales: ['categorical'], members }),
  ).toEqual([
    'color: this display takes value, field, scale, domain, range, not scheme',
  ])
  expect(
    colorSpecProblems(ramped, {
      scales: ['categorical', 'linear'],
      members: [...members, 'scheme'],
    }),
  ).toEqual([])
})
