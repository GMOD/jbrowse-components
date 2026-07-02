import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import ConfigSlot, { toCallbackValue, toFixedValue } from './configurationSlot.ts'
import { readConfObject } from './util.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()
const jexl = pluginManager.jexl

// A config slot is now a bare value-union property on the parent: the value
// type OR a `jexl:...` callback string. jexl is evaluated on read by
// readConfObject. These tests exercise that runtime behavior through a schema.

function makeConfig(def: Parameters<typeof ConfigSlot>[0], value?: unknown) {
  const schema = ConfigurationSchema('Test', { slot: def })
  return schema.create(value === undefined ? undefined : { slot: value }, {
    pluginManager,
  })
}

test('ConfigSlot builds a value-union property with a default', () => {
  const config = makeConfig({ type: 'string', defaultValue: 'foo' })
  expect(readConfObject(config, 'slot')).toBe('foo')
})

test('ConfigSlot requires a type', () => {
  // @ts-expect-error deliberately missing type
  expect(() => ConfigSlot({ defaultValue: 'x' })).toThrow(/type name required/)
})

test('ConfigSlot requires a defaultValue', () => {
  expect(() =>
    // @ts-expect-error deliberately missing defaultValue
    ConfigSlot({ type: 'string' }),
  ).toThrow(/defaultValue/)
})

test('a jexl callback is evaluated on read with args', () => {
  const config = makeConfig(
    { type: 'color', defaultValue: 'red' },
    "jexl:'#'+a",
  )
  expect(readConfObject(config, 'slot', { a: 'zonk' })).toBe('#zonk')
})

test('a numeric jexl callback is evaluated on read', () => {
  const config = makeConfig({ type: 'number', defaultValue: 1 }, 'jexl:5+a')
  expect(readConfObject(config, 'slot', { a: 5 })).toBe(10)
})

test('an empty jexl body reads back literally without throwing (#4181)', () => {
  const config = makeConfig({ type: 'color', defaultValue: 'red' }, 'jexl:')
  expect(() => readConfObject(config, 'slot')).not.toThrow()
  expect(readConfObject(config, 'slot')).toBe('jexl:')
})

test('a callback default is evaluated per-read', () => {
  const config = makeConfig({
    type: 'string',
    defaultValue: "jexl:get(feature,'name')",
  })
  expect(
    readConfObject(config, 'slot', {
      feature: { get: (k: string) => (k === 'name' ? 'abc' : undefined) },
    }),
  ).toBe('abc')
})

test('stringEnum slot uses a custom model and reads its value', () => {
  const config = makeConfig({
    type: 'stringEnum',
    model: types.enumeration('Mode', ['a', 'b']),
    defaultValue: 'a',
  })
  expect(readConfObject(config, 'slot')).toBe('a')
  config.setSlot('slot', 'b')
  expect(readConfObject(config, 'slot')).toBe('b')
})

describe('toCallbackValue', () => {
  test.each([
    ['hello', 'jexl:"hello"'],
    ['fo"o', String.raw`jexl:"fo\"o"`],
    [42, 'jexl:42'],
    [false, 'jexl:false'],
    [0, 'jexl:0'],
    [['a', 'b'], 'jexl:["a","b"]'],
    [{ x: 1 }, 'jexl:{"x":1}'],
  ])('wraps %p as %p', (value, expected) => {
    expect(toCallbackValue(value)).toBe(expected)
  })

  test('leaves an existing callback unchanged', () => {
    expect(toCallbackValue('jexl:get(feature,"x")')).toBe(
      'jexl:get(feature,"x")',
    )
  })
})

describe('toFixedValue', () => {
  test('returns a non-callback value unchanged', () => {
    expect(toFixedValue('red', 'color', 'black', jexl)).toBe('red')
  })

  test('evaluates a resolvable callback with no args', () => {
    expect(toFixedValue('jexl:2+3', 'number', 0, jexl)).toBe(5)
    expect(toFixedValue('jexl:"hi"', 'string', '', jexl)).toBe('hi')
  })

  test('falls back to defaultValue when eval yields undefined', () => {
    expect(toFixedValue('jexl:undeclaredVar', 'string', 'myDefault', jexl)).toBe(
      'myDefault',
    )
  })

  test('falls back to type default when defaultValue is itself a callback', () => {
    expect(toFixedValue('jexl:undefined', 'color', 'jexl:foo', jexl)).toBe(
      'black',
    )
  })

  test('throws if a callback default has no type fallback', () => {
    expect(() =>
      toFixedValue('jexl:undefined', 'mysteryType', 'jexl:foo', jexl),
    ).toThrow(/fallbackDefault/)
  })
})
