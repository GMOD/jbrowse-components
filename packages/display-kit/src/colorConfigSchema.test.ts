import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { paletteColors, rowPaletteColorAt } from '@jbrowse/core/ui/colors'
import { compareStructural } from 'mobx'

import {
  COLOR_SCALES,
  colorChannelOptions,
  colorConfigSchema,
  colorDomainEndsSlots,
  colorDomainSlot,
  colorEncodingOf,
  colorFieldSlot,
  colorForField,
  colorForScheme,
  colorForValue,
  colorRampSlots,
  colorRangeSlot,
  colorScaleOptions,
  colorScaleTypeSlot,
  colorSettingOf,
  colorSnapshotOf,
  dealRowColors,
  definedColor,
  paintedColorEncoding,
  parkedColorOf,
} from './colorConfigSchema.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const TestColor = ConfigurationSchema(
  'TestColor',
  {
    value: { type: 'color', defaultValue: 'red' },
    ...colorFieldSlot({ field: 'field', fieldType: 'featureField' }),
    scale: ConfigurationSchema(
      'TestColorScale',
      {
        ...colorScaleTypeSlot({
          scales: COLOR_SCALES,
          scaleName: 'TestColorScaleType',
        }),
        ...colorDomainSlot({}),
        ...colorDomainEndsSlots,
        ...colorRangeSlot({}),
        ...colorRampSlots,
      },
      colorScaleOptions('color.scale'),
    ),
  },
  colorChannelOptions('color'),
)

function encodingOf(snapshot: Record<string, unknown>) {
  return colorEncodingOf(
    colorSettingOf(TestColor.create(snapshot, { pluginManager })),
  )
}

const WRITTEN = {
  domain: ['1', '2'],
  domainMin: 0,
  domainMax: 10,
  domainMid: 5,
  range: ['white', 'red'],
  scheme: 'viridis',
  reverse: true,
}

// A fetch key compares the encoding structurally, and `{ a: 1, b: undefined }`
// is not `{ a: 1 }`, so a scale whose keys followed what a config happened to
// write would refetch on a write that paints the same.
test.each(['ordinal', 'threshold', 'linear', 'log'])(
  'a %s scale answers one fixed set of keys whatever is written',
  type => {
    const bare = encodingOf({ field: 'score', scale: { type } })
    const full = encodingOf({ field: 'score', scale: { type, ...WRITTEN } })
    expect(typeof bare).toBe('object')
    expect(Object.keys(bare).sort()).toEqual(Object.keys(full).sort())
  },
)

test('an unset member and one written at its default are one key', () => {
  expect(
    compareStructural(
      encodingOf({ field: 'score', scale: { type: 'linear' } }),
      encodingOf({
        field: 'score',
        scale: {
          type: 'linear',
          domain: [],
          range: [],
          reverse: false,
          domainMin: undefined,
        },
      }),
    ),
  ).toBe(true)
})

test('each scale carries the members it reads under the config names', () => {
  expect(
    encodingOf({ field: 'score', scale: { type: 'log', ...WRITTEN } }),
  ).toEqual({
    field: 'score',
    scale: 'log',
    domainMin: 0,
    domainMax: 10,
    domainMid: 5,
    range: ['white', 'red'],
    scheme: 'viridis',
    reverse: true,
  })
  expect(
    encodingOf({ field: 'pip', scale: { type: 'threshold', ...WRITTEN } }),
  ).toEqual({
    field: 'pip',
    scale: 'threshold',
    domain: ['1', '2'],
    range: ['white', 'red'],
  })
  expect(encodingOf({ field: 'strand', scale: WRITTEN })).toEqual({
    field: 'strand',
    scale: 'ordinal',
    domain: ['1', '2'],
    range: ['white', 'red'],
  })
  expect(encodingOf({ value: 'blue', field: 'strand' })).toMatchObject({
    field: 'strand',
  })
})

// The scale follows `field` and the display's own default alone: a written
// range used to make an unset scale linear, so emptying it flipped the key.
test('the scale is never read off which output member is written', () => {
  const scaleOf = (scale: Record<string, unknown>) => {
    const encoding = encodingOf({ field: 'score', scale })
    return typeof encoding === 'object' ? encoding.scale : 'none'
  }
  expect(scaleOf({ range: ['white', 'red'] })).toBe('ordinal')
  expect(scaleOf({ range: [] })).toBe('ordinal')
  expect(scaleOf({ scheme: 'viridis' })).toBe('ordinal')
})

test('a threshold writing cuts and no range spreads its scheme, else leaves the display its colors', () => {
  const rangeOf = (scale: Record<string, unknown>) => {
    const encoding = encodingOf({
      field: 'x',
      scale: { type: 'threshold', ...scale },
    })
    return typeof encoding === 'object' && 'range' in encoding
      ? encoding.range
      : undefined
  }
  expect(rangeOf({ domain: ['1', '2'], scheme: 'viridis' })).toHaveLength(3)
  expect(rangeOf({ domain: ['1'], scheme: 'viridis', reverse: true })).toEqual(
    rangeOf({ domain: ['1'], scheme: 'viridis' })?.toReversed(),
  )
  expect(rangeOf({ domain: ['1'] })).toBeUndefined()
  expect(rangeOf({ scheme: 'viridis' })).toBeUndefined()
  expect(
    rangeOf({ domain: ['1'], scheme: 'viridis', range: ['red', 'blue'] }),
  ).toEqual(['red', 'blue'])
})

test('a field name written as the constant is refused with the field spelling', () => {
  const create = (value: string) =>
    colorConfigSchema.create({ value }, { pluginManager })
  expect(() => create('pairOrientation')).toThrow(
    'To color by the field, write encoding.color: { "field": "pairOrientation" }',
  )
  expect(() => create("jexl:get(feature,'score')>1?'red':'blue'")).not.toThrow()
  expect(() => create('255,0,0')).not.toThrow()
})

test('a bare string is the field, and a color written as one is refused with the constant spelling', () => {
  const color = colorConfigSchema.create('gene_biotype' as never, {
    pluginManager,
  })
  expect(colorSettingOf(color).field).toBe('gene_biotype')
  expect(() =>
    colorConfigSchema.create('red' as never, { pluginManager }),
  ).toThrow('write encoding.color: { "value": "red" }')
})

describe('colorSettingOf', () => {
  it('reads a callback value as written and leaves the key to the display', () => {
    const color = colorConfigSchema.create(
      {
        value: 'jexl:get(feature,"rgb")',
        field: 'score',
        scale: { domainQuantile: 0.9, names: ['low'] },
        legend: { title: 'Score' },
      },
      { pluginManager },
    )
    expect(colorSettingOf(color)).toStrictEqual({
      value: 'jexl:get(feature,"rgb")',
      field: 'score',
      scale: {
        type: undefined,
        domain: [],
        range: [],
        scheme: undefined,
        reverse: undefined,
        domainMin: undefined,
        domainMax: undefined,
        domainMid: undefined,
        domainQuantile: 0.9,
        unknown: undefined,
        invalid: undefined,
      },
      legend: {},
    })
    expect(colorSnapshotOf(color)).toMatchObject({
      scale: { names: ['low'] },
      legend: { title: 'Score' },
    })
  })

  it('reads only the members the schema declares', () => {
    const setting = colorSettingOf(
      TestColor.create({ field: 'score', scale: WRITTEN }, { pluginManager }),
    )
    expect(setting).toStrictEqual({
      value: 'red',
      field: 'score',
      scale: { type: undefined, ...WRITTEN },
      legend: {},
    })
  })
})

describe('colorForField', () => {
  const tag = {
    value: 'grey',
    field: 'tags.HP',
    scale: { type: 'ordinal', domain: ['1', '2'], range: ['red', 'blue'] },
  }

  test('the constant drops the field and its scale', () => {
    expect(colorForField(tag, '')).toEqual({ value: 'grey' })
    expect(parkedColorOf(tag)).toEqual({
      field: 'tags.HP',
      scale: { type: 'ordinal', domain: ['1', '2'], range: ['red', 'blue'] },
    })
  })

  test('the field already named keeps its scale', () => {
    expect(colorForField(tag, 'tags.HP')).toEqual(tag)
  })

  test('the parked field takes its scale back beside the constant', () => {
    const parked = parkedColorOf(tag)
    expect(colorForField({ value: 'pink' }, 'tags.HP', parked)).toEqual({
      ...tag,
      value: 'pink',
    })
    expect(colorForField({}, 'strand', parked)).toEqual({ field: 'strand' })
  })

  test('a new field keeps only the value', () => {
    expect(colorForField(tag, 'strand')).toEqual({
      value: 'grey',
      field: 'strand',
    })
    expect(colorForField({ field: 'tags.HP' }, 'strand')).toEqual({
      field: 'strand',
    })
  })

  test('copies the lists rather than handing the same arrays back', () => {
    expect(colorForField(tag, 'tags.HP').scale?.domain).not.toBe(
      tag.scale.domain,
    )
  })

  test('a fieldless identity scale goes with the field it never had', () => {
    expect(colorForField({ scale: { type: 'identity' } }, '')).toEqual({})
  })
})

// A write compares against the snapshot, which omits an all-default part, so a
// pick that leaves `scale: {}` behind would write, park and re-bake for nothing.
test('a defined color drops unset members and empty parts', () => {
  expect(
    definedColor({
      field: 'x',
      value: undefined,
      scale: { domain: undefined },
      legend: {},
    }),
  ).toEqual({ field: 'x' })
})

describe('colorForScheme', () => {
  it('names the ramp and drops what would turn or replace it', () => {
    expect(
      colorForScheme(
        { field: 'identity', scale: { reverse: true, range: ['red', 'blue'] } },
        'magma',
        'viridis',
      ),
    ).toEqual({ field: 'identity', scale: { scheme: 'magma' } })
  })

  it('leaves the default ramp unset', () => {
    expect(
      colorForScheme(
        { scale: { scheme: 'magma', type: 'log' } },
        'viridis',
        'viridis',
      ),
    ).toEqual({ scale: { type: 'log' } })
  })
})

describe('colorForValue', () => {
  test('paints the value and drops the field, which would paint over it', () => {
    expect(
      colorForValue({ field: 'type', scale: { domain: ['gene'] } }, 'red'),
    ).toEqual({ value: 'red' })
  })

  test('undefined returns to the features own color', () => {
    expect(colorForValue({ value: 'red', field: '' }, undefined)).toEqual({
      field: '',
    })
  })
})

describe('dealRowColors', () => {
  const [p0, p1, p2] = [0, 1, 2].map(rowPaletteColorAt)
  const deal = (
    order: string[],
    entries: { domain: string[]; range: string[]; unknown?: string },
  ) => Object.fromEntries(dealRowColors(order, entries))

  it('deals tableau10 less its grey, then re-lit laps of it rather than wrapping', () => {
    const order = Array.from({ length: 28 }, (_, i) => `v${i}`)
    const colors = [...dealRowColors(order, { domain: [], range: [] }).values()]
    expect(colors.slice(0, 9)).toEqual(
      paletteColors.tableau10.filter(hex => hex !== '#bab0ab'),
    )
    expect(new Set(colors.slice(0, 27)).size).toBe(27)
    expect(colors[9]).not.toBe(colors[0])
    expect(colors[27]).toBe(colors[0])
  })

  it("deals nothing past the pairs under unknown: '', the spares unread", () => {
    expect(
      deal(['a', 'b', 'c'], {
        domain: ['b'],
        range: ['#00f', '#0f0'],
        unknown: '',
      }),
    ).toEqual({ b: '#00f' })
  })

  it('gives every unlisted value an unknown color', () => {
    expect(
      deal(['a', 'b', 'c'], {
        domain: ['b'],
        range: ['#00f'],
        unknown: '#ccc',
      }),
    ).toEqual({ a: '#ccc', b: '#00f', c: '#ccc' })
  })

  it('deals the palette in first-seen order', () => {
    expect(deal(['a', 'b', 'a', 'c'], { domain: [], range: [] })).toEqual({
      a: p0,
      b: p1,
      c: p2,
    })
  })

  it('pairs a listed value with its range color, which takes no turn', () => {
    expect(deal(['a', 'b', 'c'], { domain: ['b'], range: ['#00f'] })).toEqual({
      a: p0,
      b: '#00f',
      c: p1,
    })
  })

  it('spends the range past the domain before the palette', () => {
    expect(
      deal(['a', 'b', 'c', 'd'], { domain: [], range: ['r0', 'r1'] }),
    ).toEqual({ a: 'r0', b: 'r1', c: p0, d: p1 })
  })
})

describe('paintedColorEncoding', () => {
  it('drops the key names and keeps what paints', () => {
    expect(
      paintedColorEncoding({
        field: 'impact',
        scale: 'ordinal',
        domain: ['HIGH'],
        range: ['red'],
        names: ['Loss of function'],
      }),
    ).toEqual({
      field: 'impact',
      scale: 'ordinal',
      domain: ['HIGH'],
      range: ['red'],
    })
    expect(paintedColorEncoding('red')).toBe('red')
    expect(paintedColorEncoding(undefined)).toBeUndefined()
  })
})
