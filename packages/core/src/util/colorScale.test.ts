import {
  colorNotices,
  colorProblems,
  fieldScaleOf,
  scaleEndsOf,
  withPreset,
} from './colorScale.ts'

import type {
  ColorScaleSlots,
  ColorSlots,
  RampScaleName,
} from './colorScale.ts'
import type { ColorScaleTable, ContinuousRef } from './markEncodingTypes.ts'

type RampTable = Extract<ColorScaleTable, { kind: 'ramp' }>

// markEncodingTypes.ts spells the ramp scales out to stay a leaf
// (moduleClosure.test.ts), so both directions are pinned here.
test('the wire types name every ramp scale and no other', () => {
  const ramp: RampScaleName[] = []
  const wire: ContinuousRef['scale'][] = ramp
  const table: RampTable['scale'][] = ramp
  const back: RampScaleName[] = [...wire, ...table]
  expect(back).toEqual([])
})

test("a field's scale comes from the table's own keys, then its *", () => {
  const presets = {
    source: { scale: { type: 'ordinal' } },
    '*': { scale: { type: 'threshold' } },
  } as const
  expect(fieldScaleOf(presets, 'source')).toBe('ordinal')
  expect(fieldScaleOf(presets, 'score')).toBe('threshold')
  expect(fieldScaleOf(presets, 'toString')).toBe('threshold')
  expect(fieldScaleOf({}, 'score')).toBe('ordinal')
})

const LD = {
  r2: {
    scale: {
      type: 'threshold',
      domain: ['0.2', '0.8'],
      range: ['a', 'b', 'c'],
    },
  },
} as const

test('a preset fills the members a config leaves unwritten, an empty list among them', () => {
  expect(withPreset({ field: 'r2', scale: { domain: [] } }, LD)).toEqual({
    field: 'r2',
    scale: { domain: ['0.2', '0.8'], range: ['a', 'b', 'c'] },
    legend: {},
  })
  expect(
    withPreset(
      { field: 'r2', scale: { type: 'threshold', domain: ['0.5'] } },
      LD,
    ),
  ).toMatchObject({ scale: { domain: ['0.5'], range: ['a', 'b', 'c'] } })
})

test("written cuts take a threshold preset's palette and none of its interval names", () => {
  const presets = {
    q: {
      scale: {
        type: 'threshold',
        domain: ['10'],
        range: ['a', 'b'],
        names: ['low', 'high'],
      },
    },
  } as const
  expect(
    withPreset({ field: 'q', scale: { domain: ['5', '20'] } }, presets),
  ).toEqual({
    field: 'q',
    scale: { domain: ['5', '20'], range: ['a', 'b'] },
    legend: {},
  })
  expect(withPreset({ field: 'q' }, presets)).toMatchObject({
    scale: { names: ['low', 'high'] },
  })
})

test("strand's universal preset sits under every display's own table", () => {
  expect(
    withPreset({ field: 'strand', scale: { names: ['Plus', 'Minus'] } }, {}),
  ).toEqual({
    field: 'strand',
    scale: {
      names: ['Plus', 'Minus'],
      domain: ['1', '-1', '0'],
      range: ['tomato', 'cornflowerblue', 'goldenrod'],
    },
    legend: {},
  })
  expect(
    colorProblems({ field: 'strand', scale: { names: ['Plus', 'Minus'] } }, {}),
  ).toEqual([])
  const own = { strand: { scale: { type: 'ordinal' } } } as const
  expect(withPreset({ field: 'strand' }, own)).toEqual({ field: 'strand' })
})

test("a written domain takes none of an ordinal preset's range or names", () => {
  expect(
    withPreset({ field: 'strand', scale: { domain: ['-1', '1'] } }, {}),
  ).toEqual({ field: 'strand', scale: { domain: ['-1', '1'] } })
})

test('a preset stays out of a color painting through another scale', () => {
  const linear = { field: 'r2', scale: { type: 'linear', domain: [] } }
  expect(withPreset(linear, LD)).toBe(linear)
  const other = { field: 'score' }
  expect(withPreset(other, LD)).toBe(other)
})

test("a config's range read against a preset's cuts is held to them", () => {
  expect(
    colorProblems({ field: 'r2', scale: { range: ['a', 'b'] } }, LD).map(
      p => p.rule,
    ),
  ).toEqual(['threshold-range'])
})

test("cuts a config writes are never held to the preset's range", () => {
  expect(
    colorProblems({ field: 'r2', scale: { domain: ['0.5'] } }, LD),
  ).toEqual([])
})

const rules = (color: ColorSlots, type = 'ordinal') =>
  colorProblems(color, { '*': { scale: { type } } }).map(p => p.rule)

const scaled = (scale: ColorScaleSlots, field = 'x'): ColorSlots => ({
  field,
  scale,
})

test('a color with no field says nothing', () => {
  expect(
    rules({ scale: { domain: ['b', 'a'], range: ['red'] } }, 'threshold'),
  ).toEqual([])
})

test('threshold cuts must ascend and be numbers', () => {
  expect(rules(scaled({ type: 'threshold', domain: [1, 2] }))).toEqual([])
  expect(rules(scaled({ type: 'threshold', domain: [2, 1] }))).toEqual([
    'threshold-cuts',
  ])
  expect(rules(scaled({ type: 'threshold', domain: ['a'] }))).toEqual([
    'threshold-cuts',
  ])
})

test('a threshold range has one color per interval, one more than its cuts', () => {
  const range = (colors: string[]) =>
    rules(scaled({ type: 'threshold', domain: [1, 2], range: colors }))
  expect(range([])).toEqual([])
  expect(range(['a', 'b', 'c'])).toEqual([])
  expect(range(['a', 'b'])).toEqual(['threshold-range'])
  expect(range(['a', 'b', 'c', 'd'])).toEqual(['threshold-range'])
})

test('the field scale decides for an unset scale type', () => {
  const color = scaled({ domain: [2, 1] })
  expect(rules(color, 'threshold')).toEqual(['threshold-cuts'])
  expect(rules(color, 'ordinal')).toEqual([])
})

test('a ramp reads no domain, and its ends in either order are named', () => {
  expect(rules(scaled({ type: 'linear', domain: ['0'] }))).toEqual([
    'ramp-domain',
  ])
  expect(rules(scaled({ type: 'log', domainMin: 10, domainMax: 1 }))).toEqual([
    'domain-ends',
  ])
})

test('a ramp of one color is named, since it paints every value alike', () => {
  expect(rules(scaled({ type: 'linear', range: ['red'] }))).toEqual([
    'ramp-range',
  ])
  expect(rules(scaled({ type: 'linear', range: ['white', 'red'] }))).toEqual([])
})

test('a ramp quantile outside 0.5 to 1 is named, a percent among them', () => {
  const quantile = (domainQuantile: number) =>
    rules(scaled({ type: 'linear', domainQuantile }))
  expect(quantile(99)).toEqual(['domain-quantile'])
  expect(quantile(0.2)).toEqual(['domain-quantile'])
  expect(quantile(0.99)).toEqual([])
  expect(quantile(1)).toEqual([])
})

test('a notice line names the channel and the scale member', () => {
  expect(
    colorNotices(scaled({ type: 'linear', domain: ['0'] }), {
      '*': { scale: { type: 'ordinal' } },
    })[0],
  ).toMatch(
    /^encoding\.color\.scale\.domain: a linear, log or symlog scale reads no domain/,
  )
  expect(
    colorNotices(scaled({ type: 'log', domainMin: 0 }), {}, 'rowColor')[0],
  ).toMatch(/^rowColor\.scale\.domainMin: a log scale has no 0/)
})

test('an identity scale names one color per name, with or without a field', () => {
  const identity = { type: 'identity', domain: ['red', 'blue'] }
  expect(rules({ scale: { ...identity, names: ['a', 'b'] } })).toEqual([])
  expect(rules(scaled({ ...identity, names: ['a', 'b'] }))).toEqual([])
  expect(rules({ scale: { ...identity, names: ['a', 'b', 'c'] } })).toEqual([
    'names-domain',
  ])
  expect(rules({ scale: { names: ['a'] } })).toEqual(['names-domain'])
})

test("a preset's domain is the order names follow, and a threshold with no cuts counts none", () => {
  const presets = {
    strand: { scale: { type: 'ordinal', domain: ['1', '-1'] } },
    band: { scale: { type: 'threshold' } },
  } as const
  const problems = (color: ColorSlots) =>
    colorProblems(color, presets).map(p => p.rule)
  expect(problems(scaled({ names: ['+', '-'] }, 'strand'))).toEqual([])
  expect(problems(scaled({ names: ['+', '-', '?'] }, 'strand'))).toEqual([
    'names-domain',
  ])
  expect(problems(scaled({ names: ['a', 'b', 'c'] }, 'band'))).toEqual([])
  expect(
    problems(scaled({ domain: ['5'], names: ['a', 'b', 'c'] }, 'band')),
  ).toEqual(['names-domain'])
})

test('unknown with no domain paints every value, and outside an ordinal scale nothing', () => {
  expect(rules(scaled({ unknown: 'grey' }, 'type'))).toEqual(['unknown-domain'])
  expect(rules(scaled({ unknown: '' }, 'type'))).toEqual(['unknown-domain'])
  expect(rules(scaled({ unknown: 'grey' }, 'score'), 'linear')).toEqual([
    'unknown-scale',
  ])
  expect(rules({ scale: { unknown: 'grey' } })).toEqual(['unknown-scale'])
  expect(rules(scaled({ domain: ['a'], unknown: 'grey' }, 'type'))).toEqual([])
  expect(
    colorProblems(scaled({ unknown: 'grey' }, 'strand'), {
      strand: { scale: { type: 'ordinal', domain: ['1', '-1'] } },
    }),
  ).toEqual([])
})

test('a scale reads the quantile member its fence names and no other', () => {
  const members: Record<string, unknown> = {
    domainQuantile: 0.5,
    fenceQuantile: 0.9,
  }
  const read = (name: string) => members[name]
  expect(scaleEndsOf(read).domainQuantile).toBe(0.5)
  expect(scaleEndsOf(read, 'fenceQuantile').domainQuantile).toBe(0.9)
  expect(
    scaleEndsOf(name => (name === 'fenceQuantile' ? 0.9 : undefined))
      .domainQuantile,
  ).toBeUndefined()
})
