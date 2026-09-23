import {
  getConfigurationSchemaDefinition,
  readConfObject,
} from '@jbrowse/core/configuration'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import configSchemaFactory from './configSchema.ts'
import { DEFAULT_HIC_COLOR_SCHEME } from './hicColorConfigSchema.ts'

function make(snap: Record<string, unknown> = {}) {
  return configSchemaFactory().create({
    type: 'LinearHicDisplay',
    displayId: 'hic-test',
    ...snap,
  })
}

describe('color', () => {
  test('unset, it is a linear juicebox ramp', () => {
    const conf = make()
    expect(readConfObject(conf, ['color', 'scheme'])).toBe(
      DEFAULT_HIC_COLOR_SCHEME,
    )
    expect(readConfObject(conf, ['color', 'scale'])).toBe('linear')
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
    expect(() => make({ color: { field: 'count' } })).toThrow(/field/)
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
    'jexlFilters',
    'maxFeatureScreenDensity',
    'fetchSizeLimit',
    'forceLoad',
  ])('publishes no %s slot, which it never reads', slot => {
    expect(slots()).not.toContain(slot)
  })
})
