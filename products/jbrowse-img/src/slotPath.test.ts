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
  mergeSettings(target, { color: { palette: ['red'] }, height: 200 })
  expect(target).toEqual({
    color: { field: 'strand', palette: ['red'] },
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
