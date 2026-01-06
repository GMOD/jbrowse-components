import PluginManager from '../PluginManager.ts'
import ConfigSlot from './configurationSlot.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

test('can convert a string slot to and from a callback', () => {
  const model = ConfigSlot('tester', { type: 'string', defaultValue: 'foo' })
  const instance = model.create(undefined, { pluginManager })
  expect(instance.value).toBe('foo')
  expect(instance.expr.eval()).toBe('foo')
  instance.convertToCallback()
  expect(instance.value).toBe('jexl:"foo"')
  expect(instance.expr.eval()).toBe('foo')
  instance.convertToValue()
  expect(instance.value).toBe('foo')
  expect(instance.expr.eval()).toBe('foo')
})

test('can convert a numeric slot to and from a callback', () => {
  const model = ConfigSlot('tester', {
    type: 'number',
    defaultValue: 12,
    contextVariable: ['something'],
  })
  const instance = model.create(undefined, { pluginManager })
  expect(instance.value).toBe(12)
  expect(instance.expr.eval()).toBe(12)
  instance.convertToCallback()
  expect(instance.value).toBe('jexl:12')
  expect(instance.expr.eval()).toBe(12)
})

test('can convert a stringArray slot to and from a callback', () => {
  const model = ConfigSlot('tester', {
    type: 'stringArray',
    defaultValue: ['foo', 'bar'],
  })
  const instance = model.create(undefined, { pluginManager })
  expect(instance.value).toEqual(['foo', 'bar'])
  expect(instance.expr.eval()).toEqual(['foo', 'bar'])
  instance.convertToCallback()
  expect(instance.value).toContain('jexl:')
  expect(instance.expr.eval()).toEqual(['foo', 'bar'])
  instance.convertToValue()
  expect(instance.expr.eval()).toEqual(['foo', 'bar'])
  expect(instance.value).toEqual(['foo', 'bar'])
})

test('can convert a slot with a default function value to a scalar value', () => {
  const model = ConfigSlot('tester', {
    type: 'string',
    defaultValue: 'jexl:get(feature,"foo")',
  })
  const instance = model.create(undefined, { pluginManager })
  expect(instance.value).toBe('jexl:get(feature,"foo")')
  expect(() => instance.expr.eval()).toThrow()
  instance.convertToCallback()
  expect(instance.value).toBe('jexl:get(feature,"foo")')
  expect(() => instance.expr.eval()).toThrow()
  instance.convertToValue()
  expect(instance.value).not.toContain('jexl:')
  expect(instance.value).toBe('')
  expect(instance.expr.eval()).toEqual('')
})
