import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import ConfigSlot, {
  toCallbackValue,
  toFixedValue,
} from './configurationSlot.ts'
import { readConfObject } from './readConfObject.ts'

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
  expect(() => ConfigSlot({ defaultValue: 'x' })).toThrow(/known type name/)
})

// The check is a set membership rather than a truthiness test precisely so it
// catches this: `type: 'enum'` is a name the builtin table has never had, and
// with a `model` supplied the slot used to build fine and merely stop being
// recognised as an enum anywhere downstream (no `choices` in the editor). TS
// closes it for in-tree callers; this closes it for a JS plugin, or one built
// against a core that predates the narrowed signature.
test('ConfigSlot rejects a type name outside the closed set', () => {
  expect(() =>
    // @ts-expect-error 'enum' has never been a slot type name
    ConfigSlot({ type: 'enum', model: types.string, defaultValue: 'x' }),
  ).toThrow(/known type name, got "enum"/)
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

describe('a featureField slot', () => {
  const expression = "jexl:get(feature,'name')"

  test('hands its jexl: expression over as written, with or without args', () => {
    const config = makeConfig(
      { type: 'featureField', defaultValue: '' },
      expression,
    )
    expect(readConfObject(config, 'slot')).toBe(expression)
    expect(readConfObject(config, 'slot', { feature: undefined })).toBe(
      expression,
    )
  })

  test('hands it over from inside a sub-schema', () => {
    const Channel = ConfigurationSchema('Channel', {
      field: { type: 'featureField', defaultValue: '' },
    })
    const config = ConfigurationSchema('Host', { channel: Channel }).create(
      { channel: { field: expression } },
      { pluginManager },
    )
    expect(readConfObject(config, ['channel', 'field'])).toBe(expression)
  })

  test('refuses a contextVariable, which would make it a callback', () => {
    expect(() =>
      ConfigSlot({
        type: 'featureField',
        defaultValue: '',
        contextVariable: ['feature'],
      }),
    ).toThrow(/featureField/)
  })
})

describe('a color slot', () => {
  const colorSlot = (value?: unknown) =>
    makeConfig({ type: 'color', defaultValue: 'red' }, value)

  test.each([
    'red',
    'Red',
    'steelblue',
    '#f00',
    '#ff0000',
    '#ff000080',
    'rgb(255,0,0)',
    'rgba(255, 0, 0, 0.5)',
    'hsl(120,100%,50%)',
    'hsla(120, 100%, 50%, 0.3)',
    'transparent',
    '255,0,0',
  ])('accepts %s', value => {
    expect(readConfObject(colorSlot(value), 'slot')).toBe(value)
  })

  test('accepts a jexl callback', () => {
    expect(readConfObject(colorSlot("jexl:'blue'"), 'slot')).toBe('blue')
  })

  test('accepts the empty string, which outlineColor spells "no outline" with', () => {
    expect(readConfObject(colorSlot(''), 'slot')).toBe('')
  })

  // A field name where a color goes used to load and paint the invalid
  // sentinel; ggplot2 fails the same mistake at draw time.
  test.each(['biotype', 'strand'])(
    'refuses %s, naming the slot, the value and what a color is',
    value => {
      expect(() => colorSlot(value)).toThrow(
        `${JSON.stringify(value)} is not a color. A color is a CSS color`,
      )
      expect(() => colorSlot(value)).toThrow('/slot')
    },
  )

  test('maybeColor stays unset by default and refuses a non-color too', () => {
    expect(
      readConfObject(makeConfig({ type: 'maybeColor' }), 'slot'),
    ).toBeUndefined()
    expect(() => makeConfig({ type: 'maybeColor' }, 'biotype')).toThrow(
      'is not a color',
    )
  })
})

describe('a colorArray slot', () => {
  const colors = (value?: unknown) =>
    makeConfig({ type: 'colorArray', defaultValue: [] }, value)

  test('holds CSS colours, in order', () => {
    expect(
      readConfObject(colors(['red', '#00f', 'rgb(0,128,0)']), 'slot'),
    ).toEqual(['red', '#00f', 'rgb(0,128,0)'])
  })

  test.each([[['nosuchcolor', 'red']], [['magma']], [['']]])(
    'refuses %j at load, naming the path and the entry',
    value => {
      expect(() => colors(value)).toThrow('/slot')
      expect(() => colors(value)).toThrow(
        `${JSON.stringify(value[0])} is not a color`,
      )
    },
  )

  test('refuses a write naming no colour and keeps the value it had', () => {
    const config = colors(['white', 'red'])
    expect(() => {
      config.setSlot('slot', ['nosuchcolor'])
    }).toThrow('Test.slot is a colorArray slot and cannot take ["nosuchcolor"]')
    expect(readConfObject(config, 'slot')).toEqual(['white', 'red'])
  })
})

describe('a stringEnumArray slot', () => {
  const glyphs = (value?: unknown) =>
    makeConfig(
      {
        type: 'stringEnumArray',
        model: types.enumeration('Glyph', ['disc', 'triangle', 'diamond']),
        defaultValue: [],
      },
      value,
    )

  test('holds members of its enumeration, in order', () => {
    expect(readConfObject(glyphs(['diamond', 'disc']), 'slot')).toEqual([
      'diamond',
      'disc',
    ])
  })

  test('refuses an entry outside the enumeration at load, naming the path', () => {
    expect(() => glyphs(['star', 'triangle'])).toThrow('/slot')
    expect(() => glyphs(['star', 'triangle'])).toThrow('"star"')
  })

  test('refuses such a write and keeps the value it had', () => {
    const config = glyphs(['triangle'])
    expect(() => {
      config.setSlot('slot', ['star'])
    }).toThrow('Test.slot is a stringEnumArray slot and cannot take ["star"]')
    expect(readConfObject(config, 'slot')).toEqual(['triangle'])
  })
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
      // @ts-expect-error an unknown slot type is a compile error since `type`
      // was narrowed to ConfigSlotType; the runtime guard stays for callers
      // that reach here from JS or from an external plugin built against an
      // older core
      toFixedValue('jexl:undefined', 'mysteryType', 'jexl:foo', jexl),
    ).toThrow(/fallbackDefault/)
  })
})
