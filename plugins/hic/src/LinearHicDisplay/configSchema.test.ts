import {
  getConfigurationSchemaDefinition,
  plotOf,
  readConfObject,
  refusingUndeclaredKeys,
} from '@jbrowse/core/configuration'
import { fieldScaleOf } from '@jbrowse/core/util/colorScale'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import configSchemaFactory from './configSchema.ts'
import {
  DEFAULT_HIC_COLOR_SCHEME,
  HIC_FIELD_PRESETS,
} from './hicColorConfigSchema.ts'

function make(snap: Record<string, unknown> = {}) {
  return configSchemaFactory().create({
    type: 'LinearHicDisplay',
    displayId: 'hic-test',
    ...snap,
  })
}

const COLOR = ['encoding', 'color'] as const

describe('encoding.color', () => {
  test('a bare string names the field, as every color channel reads one', () => {
    expect(
      readConfObject(make({ encoding: { color: 'observed' } }), [
        ...COLOR,
        'field',
      ]),
    ).toBe('observed')
  })

  test("unset, it is observed's linear juicebox ramp", () => {
    const conf = make()
    expect(readConfObject(conf, [...COLOR, 'scale', 'scheme'])).toBeUndefined()
    expect(readConfObject(conf, [...COLOR, 'field'])).toBe('observed')
    expect(readConfObject(conf, [...COLOR, 'scale', 'type'])).toBeUndefined()
    expect(fieldScaleOf(HIC_FIELD_PRESETS, 'observed')).toBe('linear')
    expect(HIC_FIELD_PRESETS.observed.scale.scheme).toBe(
      DEFAULT_HIC_COLOR_SCHEME,
    )
  })

  test.each([
    { scale: { type: 'log' } },
    { scale: { type: 'linear' } },
    { scale: { scheme: 'viridis', domainMax: 50 } },
    { scale: { scheme: 'magma', reverse: false, domainMin: 2 } },
    { scale: { domainQuantile: 1 } },
    { legend: { title: 'Contacts' } },
  ])('a config written today reads back unchanged: %j', color => {
    expect(plotOf(make({ encoding: { color } }))).toEqual({
      encoding: { color },
    })
  })

  test('a default color reads back as no plot', () => {
    expect(plotOf(make())).toEqual({})
  })

  test.each(COLOR_SCHEMES)('takes the shared %s scheme', scheme => {
    const conf = make({ encoding: { color: { scale: { scheme } } } })
    expect(readConfObject(conf, [...COLOR, 'scale', 'scheme'])).toBe(scheme)
  })

  test('picking a non-default scheme does persist', () => {
    const conf = make()
    conf.encoding.color.scale.setSlot('scheme', 'fall')
    expect(getSnapshot(conf)).toHaveProperty('encoding', {
      color: { scale: { scheme: 'fall' } },
    })
  })

  test('a write refuses a member it does not declare', () => {
    expect(() =>
      refusingUndeclaredKeys(() =>
        make({ encoding: { color: { value: 'red' } } }),
      ),
    ).toThrow(/value/)
  })

  test('the v4 flat spelling is refused, not read as no color', () => {
    expect(() =>
      refusingUndeclaredKeys(() =>
        make({ encoding: { color: { scale: 'log' } } }),
      ),
    ).toThrow()
  })

  test('maps count and nothing else', () => {
    expect(() => make({ encoding: { color: { field: 'score' } } })).toThrow()
  })
})

describe('legend', () => {
  test('is off until asked for, and reads back as legend.show', () => {
    expect(readConfObject(make(), ['legend', 'show'])).toBe(false)
    expect(plotOf(make({ legend: { show: true } }))).toEqual({
      legend: { show: true },
    })
  })
})

describe('config surface', () => {
  const slots = () =>
    Object.keys(getConfigurationSchemaDefinition(configSchemaFactory())!)

  test('keeps what its mixins read after dropping the base schema', () => {
    // TrackHeightMixin and LegendMixin, plus the identifier the base schema
    // used to supply — without it every Hi-C display shares one config node
    expect(slots()).toEqual(expect.arrayContaining(['height', 'legend']))
    expect(make().displayId).toBe('hic-test')
  })

  // Hi-C draws a contact matrix, not features, and never enables the byte
  // gate — every one of these was a documented promise nothing kept.
  test.each([
    'mouseover',
    'filter',
    'maxFeatureScreenDensity',
    'fetchSizeLimit',
    'forceLoad',
  ])('publishes no %s slot, which it never reads', slot => {
    expect(slots()).not.toContain(slot)
  })
})
