import { colorNotices, colorProblems, fieldScaleOf } from './colorScale.ts'

test("a field's scale comes from the table's own keys, then its *", () => {
  const scales = { source: 'categorical', '*': 'threshold' } as const
  expect(fieldScaleOf(scales, 'source')).toBe('categorical')
  expect(fieldScaleOf(scales, 'score')).toBe('threshold')
  expect(fieldScaleOf(scales, 'toString')).toBe('threshold')
  expect(fieldScaleOf({}, 'score')).toBe('categorical')
})

const rules = (
  color: Parameters<typeof colorProblems>[0],
  fieldScale = 'categorical',
) => colorProblems(color, fieldScale).map(p => p.rule)

test('a colour with no field, or a field under none, says nothing', () => {
  expect(rules({ domain: ['b', 'a'], range: ['red'] }, 'threshold')).toEqual([])
  expect(
    rules({ field: 'x', scale: 'none', domain: ['2', '1'] }, 'threshold'),
  ).toEqual([])
})

test('threshold cuts must ascend and be numbers', () => {
  expect(rules({ field: 'x', scale: 'threshold', domain: [1, 2] })).toEqual([])
  expect(rules({ field: 'x', scale: 'threshold', domain: [2, 1] })).toEqual([
    'threshold-cuts',
  ])
  expect(rules({ field: 'x', scale: 'threshold', domain: ['a'] })).toEqual([
    'threshold-cuts',
  ])
})

test('a threshold range has one colour per interval, one more than its cuts', () => {
  const range = (colors: string[]) =>
    rules({ field: 'x', scale: 'threshold', domain: [1, 2], range: colors })
  expect(range([])).toEqual([])
  expect(range(['a', 'b', 'c'])).toEqual([])
  expect(range(['a', 'b'])).toEqual(['threshold-range'])
  expect(range(['a', 'b', 'c', 'd'])).toEqual(['threshold-range'])
})

test('the field scale decides for an unset scale', () => {
  const color = { field: 'x', domain: [2, 1] }
  expect(rules(color, 'threshold')).toEqual(['threshold-cuts'])
  expect(rules(color, 'categorical')).toEqual([])
})

test('a ramp reads no domain, and its ends in either order are named', () => {
  expect(rules({ field: 'x', scale: 'linear', domain: ['0'] })).toEqual([
    'ramp-domain',
  ])
  expect(
    rules({ field: 'x', scale: 'log', domainMin: 10, domainMax: 1 }),
  ).toEqual(['ramp-ends'])
})

test('a notice line names the setting and the slot', () => {
  expect(
    colorNotices(
      { field: 'x', scale: 'linear', domain: ['0'] },
      'categorical',
      'fill',
    )[0],
  ).toMatch(/^fill\.domain: a linear or log scale reads no domain/)
})

test('an identity scale names one colour per label, with or without a field', () => {
  const identity = { scale: 'identity', domain: ['red', 'blue'] }
  expect(rules({ ...identity, labels: ['a', 'b'] })).toEqual([])
  expect(rules({ ...identity, field: 'x', labels: ['a', 'b'] })).toEqual([])
  expect(rules({ ...identity, labels: ['a', 'b', 'c'] })).toEqual([
    'labels-domain',
  ])
  expect(rules({ labels: ['a'] })).toEqual(['labels-domain'])
})
