import {
  isSlotPathOption,
  mergeSettings,
  slotPathSettings,
  slotValue,
} from './slotPath.ts'

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
  expect(slotPathSettings('scales.y.type=log')).toEqual({
    scales: { y: { type: 'log' } },
  })
  expect(() => slotPathSettings('color..field=x')).toThrow(/empty path segment/)
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
  expect(() =>
    mergeSettings({}, slotPathSettings('a.constructor.b=1')),
  ).toThrow(/constructor/)
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
