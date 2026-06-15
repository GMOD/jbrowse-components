import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { getEffectiveTrackConfig } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import ConfigOverrideMixin from './ConfigOverrideMixin.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Integration test for the "Copy config" path: a live display that composes
// ConfigOverrideMixin (the real setOverride/configOverrides machinery) feeding
// the real getEffectiveTrackConfig. The getConfigOverrides unit test only feeds
// hand-made plain objects; this exercises the seam where the mixin's frozen
// override map (with object values needing toJS) is consumed against a live
// config node — i.e. what a user's runtime colorBy change actually produces.

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const DisplaySchema = ConfigurationSchema(
  'LinearTestDisplay',
  {
    color: { type: 'color', defaultValue: '#f0f' },
    colorBy: { type: 'frozen', defaultValue: { type: 'normal' } },
  },
  { explicitlyTyped: true, explicitIdentifier: 'displayId' },
)

const TrackConfig = ConfigurationSchema(
  'FeatureTrack',
  {
    name: { type: 'string', defaultValue: '' },
    displays: types.array(DisplaySchema),
  },
  { explicitIdentifier: 'trackId' },
)

// A display composing the real mixin. `configuration` is a volatile pointing at
// the live config node (mirrors the real ConfigurationReference) rather than a
// containment prop, since a config node can have only one MST parent — the track
// already owns it.
const DisplayModel = types
  .compose(
    'LinearTestDisplay',
    ConfigOverrideMixin<Instance<typeof DisplaySchema>>(['color', 'colorBy']),
    types.model({}),
  )
  .volatile<{ configuration?: Instance<typeof DisplaySchema> }>(() => ({
    configuration: undefined,
  }))
  .actions(self => ({
    setConfiguration(c: Instance<typeof DisplaySchema>) {
      self.configuration = c
    },
  }))

function setup() {
  const track = TrackConfig.create(
    {
      trackId: 'track-1',
      name: 'My Track',
      displays: [{ type: 'LinearTestDisplay', displayId: 'd1' }],
    },
    { pluginManager },
  )
  const display = DisplayModel.create({})
  display.setConfiguration(track.displays[0])
  return { track, display }
}

describe('getEffectiveTrackConfig with a live ConfigOverrideMixin display', () => {
  test('no overrides → display entry keeps only type and displayId', () => {
    const { track, display } = setup()
    const result = getEffectiveTrackConfig(track, display)
    expect((result.displays as any)[0]).toEqual({
      type: 'LinearTestDisplay',
      displayId: 'd1',
    })
  })

  test('scalar override (color) flows from setOverride into effective config', () => {
    const { track, display } = setup()
    display.setOverride('color', '#ff0000')
    expect(display.getConfWithOverride('color')).toBe('#ff0000')

    const result = getEffectiveTrackConfig(track, display)
    expect((result.displays as any)[0].color).toBe('#ff0000')
  })

  test('object override (colorBy) is toJS-flattened into effective config', () => {
    const { track, display } = setup()
    display.setOverride('colorBy', { type: 'methylation' })
    expect(display.getConfWithOverride('colorBy')).toEqual({
      type: 'methylation',
    })

    const result = getEffectiveTrackConfig(track, display)
    const colorBy = (result.displays as any)[0].colorBy
    expect(colorBy).toEqual({ type: 'methylation' })
    // toJS produced a plain object, not a frozen MST proxy
    expect(JSON.stringify(colorBy)).toBe('{"type":"methylation"}')
  })

  test('scalar override equal to the config default is omitted', () => {
    const { track, display } = setup()
    display.setOverride('color', '#f0f')
    const result = getEffectiveTrackConfig(track, display)
    expect((result.displays as any)[0].color).toBeUndefined()
  })

  // getEffectiveTrackConfig dedupes against the default with deepEqual, so an
  // object/array override value-equal to the default (here colorBy back to
  // {type:'normal'}) is omitted despite toJS cloning it to a fresh reference.
  test('object override equal to the default is omitted (deep-equal)', () => {
    const { track, display } = setup()
    display.setOverride('colorBy', { type: 'normal' })
    const result = getEffectiveTrackConfig(track, display)
    expect((result.displays as any)[0].colorBy).toBeUndefined()
  })

  test('clearOverride reverts the effective config to the default', () => {
    const { track, display } = setup()
    display.setOverride('color', '#ff0000')
    display.clearOverride('color')
    expect(display.getConfWithOverride('color')).toBe('#f0f')

    const result = getEffectiveTrackConfig(track, display)
    expect((result.displays as any)[0].color).toBeUndefined()
  })

  test('reading effective config does not mutate the track config', () => {
    const { track, display } = setup()
    display.setOverride('color', '#ff0000')
    display.setOverride('colorBy', { type: 'methylation' })
    const before = JSON.stringify(track)
    getEffectiveTrackConfig(track, display)
    expect(JSON.stringify(track)).toBe(before)
  })
})
