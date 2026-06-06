import PluginManager from '../PluginManager.ts'
import ConfigSlot from './configurationSlot.ts'
import { toCallbackValue, toFixedValue } from './slotValueUtils.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const jexl = pluginManager.jexl

// The value/callback conversion that used to be `slot.convertToCallback()` /
// `slot.convertToValue()` now lives in slotValueUtils.ts (the editor calls the
// free functions and `slot.set()`s the result). These tests exercise the slot
// model's runtime surface (value/isCallback/expr/getValue/set) and confirm the
// free functions drive it as the editor does.

test('string slot value <-> callback round trip', () => {
  const model = ConfigSlot('tester', { type: 'string', defaultValue: 'foo' })
  const instance = model.create(undefined, { pluginManager })
  expect(instance.value).toBe('foo')
  expect(instance.expr.eval()).toBe('foo')
  instance.set(toCallbackValue(instance.value))
  expect(instance.value).toBe('jexl:"foo"')
  expect(instance.expr.eval()).toBe('foo')
  instance.set(
    toFixedValue(instance.value, 'string', instance.defaultValue, jexl),
  )
  expect(instance.value).toBe('foo')
  expect(instance.expr.eval()).toBe('foo')
})

test('numeric slot value -> callback', () => {
  const model = ConfigSlot('tester', { type: 'number', defaultValue: 12 })
  const instance = model.create(undefined, { pluginManager })
  expect(instance.value).toBe(12)
  expect(instance.expr.eval()).toBe(12)
  instance.set(toCallbackValue(instance.value))
  expect(instance.value).toBe('jexl:12')
  expect(instance.expr.eval()).toBe(12)
})

test('stringArray slot value <-> callback round trip', () => {
  const model = ConfigSlot('tester', {
    type: 'stringArray',
    defaultValue: ['foo', 'bar'],
  })
  const instance = model.create(undefined, { pluginManager })
  expect(instance.value).toEqual(['foo', 'bar'])
  instance.set(toCallbackValue(['foo', 'bar']))
  expect(instance.value).toContain('jexl:')
  expect(instance.expr.eval()).toEqual(['foo', 'bar'])
})

test('converting a default-function slot to a value yields the type fallback', () => {
  const model = ConfigSlot('tester', {
    type: 'string',
    defaultValue: 'jexl:get(feature,"foo")',
  })
  const instance = model.create(undefined, { pluginManager })
  expect(instance.value).toBe('jexl:get(feature,"foo")')
  expect(() => instance.expr.eval()).toThrow()
  instance.set(
    toFixedValue(instance.value, 'string', instance.defaultValue, jexl),
  )
  expect(instance.value).not.toContain('jexl:')
  expect(instance.value).toBe('')
})

test('toCallbackValue preserves falsy values (false, 0)', () => {
  // regression: || instead of ?? caused false/0 to become jexl:'' instead of
  // jexl:false / jexl:0
  expect(toCallbackValue(false)).toBe('jexl:false')
  expect(toCallbackValue(0)).toBe('jexl:0')
})

test('typing "jexl:" into a value field is detected for runtime eval', () => {
  const model = ConfigSlot('tester', { type: 'color', defaultValue: 'red' })
  const instance = model.create(undefined, { pluginManager })
  expect(instance.isCallback).toBe(false)
  instance.set('jexl:')
  // prefix detection still drives runtime eval; the editor mode is now React
  // state in SlotEditor and does not auto-swap mid-typing
  expect(instance.isCallback).toBe(true)
})

test('expr falls back to literal value when jexl body is empty (#4181)', () => {
  const model = ConfigSlot('tester', { type: 'color', defaultValue: 'red' })
  const instance = model.create(undefined, { pluginManager })
  instance.set('jexl:')
  // would otherwise throw inside stringToJexlExpression and crash the
  // track render with "TypeError: e is null"
  expect(() => instance.expr.eval()).not.toThrow()
  expect(instance.expr.eval()).toBe('jexl:')
})

test('a saved jexl callback reports isCallback', () => {
  const model = ConfigSlot('tester', {
    type: 'string',
    defaultValue: 'jexl:get(feature,"foo")',
  })
  const instance = model.create(undefined, { pluginManager })
  expect(instance.isCallback).toBe(true)
})

test('toCallbackValue escapes quotes in string values', () => {
  // regression: an unescaped `"${value}"` made `fo"o` produce invalid jexl
  const model = ConfigSlot('tester', { type: 'string', defaultValue: 'foo' })
  const instance = model.create(undefined, { pluginManager })
  instance.set(toCallbackValue('fo"o'))
  expect(instance.value).toBe(String.raw`jexl:"fo\"o"`)
  expect(instance.expr.eval()).toBe('fo"o')
})

test('toFixedValue uses defaultValue when eval returns undefined, not type fallback', () => {
  const model = ConfigSlot('tester', {
    type: 'string',
    defaultValue: 'myDefault',
  })
  const instance = model.create(undefined, { pluginManager })
  // 'jexl:undeclaredVar' evaluates to undefined with no context args
  instance.set(
    toFixedValue('jexl:undeclaredVar', 'string', instance.defaultValue, jexl),
  )
  expect(instance.value).toBe('myDefault') // not '' (the string type fallback)
})
