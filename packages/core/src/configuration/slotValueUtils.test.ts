import PluginManager from '../PluginManager.ts'
import {
  isCallbackValue,
  toCallbackValue,
  toFixedValue,
} from './slotValueUtils.ts'

const pm = new PluginManager([]).createPluggableElements()
pm.configure()
const jexl = pm.jexl

describe('isCallbackValue', () => {
  test('detects the jexl: prefix', () => {
    expect(isCallbackValue('jexl:1+1')).toBe(true)
    expect(isCallbackValue('red')).toBe(false)
    expect(isCallbackValue(42)).toBe(false)
    expect(isCallbackValue(undefined)).toBe(false)
  })
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
    expect(
      toFixedValue('jexl:undeclaredVar', 'string', 'myDefault', jexl),
    ).toBe('myDefault')
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
