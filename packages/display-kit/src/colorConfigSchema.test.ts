import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { compareStructural } from 'mobx'

import {
  COLOR_SCALES,
  colorChannelOptions,
  colorChannelSlots,
  colorDomainEndsSlots,
  colorDomainSlot,
  colorEncodingOf,
  colorForField,
  colorForValue,
  colorRampSlots,
  colorRangeSlot,
} from './colorConfigSchema.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const TestColor = ConfigurationSchema(
  'TestColor',
  {
    value: { type: 'color', defaultValue: 'red' },
    ...colorChannelSlots({
      scales: COLOR_SCALES,
      scaleName: 'TestColorScale',
      field: 'field',
      fieldType: 'featureField',
    }),
    ...colorDomainSlot({}),
    ...colorDomainEndsSlots,
    ...colorRangeSlot({}),
    ...colorRampSlots,
  },
  colorChannelOptions('color'),
)

function encodingOf(snapshot: Record<string, unknown>) {
  return colorEncodingOf(
    TestColor.create(snapshot, { pluginManager }),
    'categorical',
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
test.each(['categorical', 'threshold', 'linear', 'log'])(
  'a %s scale answers one fixed set of keys whatever is written',
  scale => {
    const bare = encodingOf({ field: 'score', scale })
    const full = encodingOf({ field: 'score', scale, ...WRITTEN })
    expect(typeof bare).toBe('object')
    expect(Object.keys(bare).sort()).toEqual(Object.keys(full).sort())
  },
)

test('an unset member and one written at its default are one key', () => {
  expect(
    compareStructural(
      encodingOf({ field: 'score', scale: 'linear' }),
      encodingOf({
        field: 'score',
        scale: 'linear',
        domain: [],
        range: [],
        reverse: false,
        domainMin: undefined,
      }),
    ),
  ).toBe(true)
})

test('each scale carries the members it reads under the config names', () => {
  expect(encodingOf({ field: 'score', scale: 'log', ...WRITTEN })).toEqual({
    field: 'score',
    scale: 'log',
    domainMin: 0,
    domainMax: 10,
    domainMid: 5,
    range: ['white', 'red'],
    scheme: 'viridis',
    reverse: true,
  })
  expect(encodingOf({ field: 'pip', scale: 'threshold', ...WRITTEN })).toEqual({
    field: 'pip',
    scale: 'threshold',
    domain: ['1', '2'],
    range: ['white', 'red'],
  })
  expect(encodingOf({ field: 'strand', ...WRITTEN })).toEqual({
    field: 'strand',
    scale: 'categorical',
    domain: ['1', '2'],
    range: ['white', 'red'],
  })
  expect(encodingOf({ value: 'blue', field: 'strand', scale: 'none' })).toBe(
    'blue',
  )
})

// The scale follows `field` and the display's own default alone: a written
// range used to make an unset scale linear, so emptying it flipped the key.
test('the scale is never read off which output member is written', () => {
  const scaleOf = (snapshot: Record<string, unknown>) => {
    const encoding = encodingOf({ field: 'score', ...snapshot })
    return typeof encoding === 'object' ? encoding.scale : 'none'
  }
  expect(scaleOf({ range: ['white', 'red'] })).toBe('categorical')
  expect(scaleOf({ range: [] })).toBe('categorical')
  expect(scaleOf({ scheme: 'viridis' })).toBe('categorical')
})

describe('colorForField', () => {
  const tag = {
    value: 'grey',
    field: 'tags.HP',
    scale: 'categorical',
    domain: ['1', '2'],
    range: ['red', 'blue'],
  }

  test('the constant keeps the field and its members under none', () => {
    expect(colorForField(tag, '')).toEqual({ ...tag, scale: 'none' })
  })

  test('the field already named keeps its members and a declared scale', () => {
    expect(colorForField(tag, 'tags.HP')).toEqual(tag)
    expect(colorForField({ ...tag, scale: 'none' }, 'tags.HP')).toEqual({
      ...tag,
      scale: undefined,
    })
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
    expect(colorForField(tag, 'tags.HP').domain).not.toBe(tag.domain)
  })
})

describe('colorForValue', () => {
  test('paints the value and sets a field aside under none', () => {
    const typed = { field: 'type', domain: ['gene'] }
    expect(colorForValue(typed, 'red')).toEqual({
      ...typed,
      value: 'red',
      scale: 'none',
    })
  })

  test('undefined returns to the features own colour', () => {
    expect(colorForValue({ value: 'red', field: '' }, undefined)).toEqual({
      field: '',
    })
  })
})
