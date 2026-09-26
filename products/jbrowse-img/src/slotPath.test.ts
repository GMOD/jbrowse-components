import {
  applySlotWrite,
  isSlotPathOption,
  mergeSettings,
  slotValue,
  slotWrite,
} from './slotPath.ts'

const write = (opt: string, into: Record<string, unknown> = {}) =>
  applySlotWrite(into, slotWrite(opt))

test('a value reads as a boolean, a number, a list or text', () => {
  expect(slotValue('true')).toBe(true)
  expect(slotValue('0.5')).toBe(0.5)
  expect(slotValue('tags.HP')).toBe('tags.HP')
  expect(slotValue('#d9c9a3')).toBe('#d9c9a3')
  expect(slotValue('tan,teal')).toEqual(['tan', 'teal'])
  expect(slotValue('tan,')).toEqual(['tan'])
  expect(slotValue('')).toBe('')
})

test('a named modifier is not a slot write', () => {
  expect(isSlotPathOption('color.field=strand')).toBe(true)
  expect(isSlotPathOption('height=300')).toBe(true)
  expect(isSlotPathOption('color:tag:HP')).toBe(false)
  expect(isSlotPathOption('index:https://example.com/a.csi?x=1')).toBe(false)
  expect(isSlotPathOption('{"a":1}')).toBe(false)
})

test('a path nests one object per segment', () => {
  expect(write('scales.y.type=log')).toEqual({
    scales: { y: { type: 'log' } },
  })
  expect(() => write('color..field=x')).toThrow(/empty path segment/)
})

// `marks`, `transform` and an aggregate's `ops` are lists of objects, so a
// path that cannot index one stops at the edge of the grammar and leaves raw
// JSON as the only way to declare a mark.
test('a digit segment indexes a list', () => {
  expect(write('marks.0.encoding.y=score')).toEqual({
    marks: [{ encoding: { y: 'score' } }],
  })
  const settings = write('marks.0.mark=bar')
  write('marks.0.encoding.y=score', settings)
  write('marks.1.mark=point', settings)
  write('marks.0.transform.0.type=bin', settings)
  expect(settings).toEqual({
    marks: [
      { mark: 'bar', encoding: { y: 'score' }, transform: [{ type: 'bin' }] },
      { mark: 'point' },
    ],
  })
})

// a list with a hole in it is one no schema accepts, so the write that would
// leave one names the entry missing before it instead
test('an index past the end names the entry to write first', () => {
  expect(() => write('marks.2.mark=bar')).toThrow(
    /index 2 is past the end of a list of 0; write index 0 first/,
  )
  const settings = write('color.range=tan,teal')
  expect(() => write('color.range.5=red', settings)).toThrow(
    /index 5 is past the end of a list of 2; write index 2 first/,
  )
})

// two writes disagreeing about one setting; carrying on drops whichever came
// first, so neither direction is allowed to
test('a path contradicting the shape already there is refused', () => {
  const settings = write('transform.0.type=bin')
  expect(() => write('transform.step=auto', settings)).toThrow(
    /"transform" is a list, not a setting/,
  )
  expect(() => write('color.0=red', write('color.field=strand'))).toThrow(
    /"color" is a setting, not a list/,
  )
})

// A whole-list value still replaces: `color.range=tan,teal` says what the
// range IS, where `color.range.0=tan` says what its first entry is.
test('a list value replaces and an index write does not', () => {
  const settings = write('color.range=tan,teal,olive')
  write('color.range.1=red', settings)
  expect(settings).toEqual({ color: { range: ['tan', 'red', 'olive'] } })
  write('color.range=grey,', settings)
  expect(settings).toEqual({ color: { range: ['grey'] } })
})

test('merging fills objects and replaces everything else', () => {
  const target = { color: { field: 'strand' }, height: 100 } as Record<
    string,
    unknown
  >
  mergeSettings(target, { color: { range: ['red'] }, height: 200 })
  expect(target).toEqual({
    color: { field: 'strand', range: ['red'] },
    height: 200,
  })
  mergeSettings(target, { color: 'purple' })
  expect(target.color).toBe('purple')
})

test('a prototype key is refused', () => {
  expect(() =>
    mergeSettings({}, JSON.parse('{"__proto__":{"polluted":true}}')),
  ).toThrow(/__proto__/)
  expect(() => write('a.constructor.b=1')).toThrow(/constructor/)
  expect(({} as Record<string, unknown>).polluted).toBeUndefined()
})

test('a jexl: item runs to the first comma outside its brackets and quotes', () => {
  const call = "jexl:get(feature,'score')>5"
  expect(slotValue(call)).toBe(call)
  expect(slotValue(`${call},`)).toEqual([call])
  expect(slotValue(`${call},jexl:[1,2][0]==1`)).toEqual([
    call,
    'jexl:[1,2][0]==1',
  ])
  expect(slotValue("jexl:get(feature,'name')=='a,b'")).toBe(
    "jexl:get(feature,'name')=='a,b'",
  )
  expect(slotValue(String.raw`jexl:'it\'s,',x`)).toEqual([
    String.raw`jexl:'it\'s,'`,
    'x',
  ])
})

test('a location keeps the commas grouping its digits', () => {
  const region = 'chr2:135,787,850-135,876,467'
  expect(slotValue(region)).toBe(region)
  expect(slotValue(`${region},`)).toEqual([region])
  expect(slotValue('chr1:1,000-2,000,chr2:5-6')).toEqual([
    'chr1:1,000-2,000',
    'chr2:5-6',
  ])
  expect(slotValue('0,100')).toEqual([0, 100])
})

test('a quote outside a jexl: item groups nothing', () => {
  expect(slotValue("5'UTR,3'UTR")).toEqual(["5'UTR", "3'UTR"])
})
