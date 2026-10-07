import {
  getConfigurationSchemaDefinition,
  plotOf,
  readConfObject,
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

describe('color', () => {
  test('a bare string names the field, as every colour object reads one', () => {
    expect(readConfObject(make({ color: 'count' }), ['color', 'field'])).toBe(
      'count',
    )
  })

  test('unset, it is a linear juicebox ramp', () => {
    const conf = make()
    expect(readConfObject(conf, ['color', 'scheme'])).toBe(
      DEFAULT_HIC_COLOR_SCHEME,
    )
    expect(readConfObject(conf, ['color', 'field'])).toBe('count')
    expect(readConfObject(conf, ['color', 'scale'])).toBeUndefined()
    expect(fieldScaleOf(HIC_FIELD_PRESETS, 'count')).toBe('linear')
  })

  test.each([
    { scale: 'log' },
    { scale: 'linear' },
    { scheme: 'viridis', domainMax: 50 },
    { scheme: 'magma', reverse: false, domainMin: 2 },
    { domainQuantile: 1 },
  ])('a config written today reads back unchanged: %j', color => {
    expect(plotOf(make({ color }))).toEqual({ color })
  })

  test('a default colour reads back as no plot', () => {
    expect(plotOf(make())).toEqual({})
  })

  test.each(COLOR_SCHEMES)('takes the shared %s scheme', scheme => {
    const conf = make({ color: { scheme } })
    expect(readConfObject(conf, ['color', 'scheme'])).toBe(scheme)
  })

  // The track menu's scheme radios write the default value rather than an
  // `undefined` reset, which marks nothing edited only because stripDefault
  // omits a slot equal to its default.
  test('picking the default writes no config delta', () => {
    const conf = make()
    conf.color.setSlot('scheme', DEFAULT_HIC_COLOR_SCHEME)
    expect(getSnapshot(conf)).not.toHaveProperty('color')
  })

  test('picking a non-default scheme does persist', () => {
    const conf = make()
    conf.color.setSlot('scheme', 'fall')
    expect(getSnapshot(conf)).toHaveProperty('color', { scheme: 'fall' })
  })

  test('refuses a member it does not declare', () => {
    expect(() => make({ color: { value: 'red' } })).toThrow(/value/)
  })

  test('maps count and nothing else', () => {
    expect(() => make({ color: { field: 'score' } })).toThrow()
  })
})

describe('config surface', () => {
  const slots = () =>
    Object.keys(getConfigurationSchemaDefinition(configSchemaFactory())!)

  test('keeps what its mixins read after dropping the base schema', () => {
    // TrackHeightMixin and LegendMixin, plus the identifier the base schema
    // used to supply — without it every Hi-C display shares one config node
    expect(slots()).toEqual(expect.arrayContaining(['height', 'showLegend']))
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
