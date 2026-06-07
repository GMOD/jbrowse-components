import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { getEffectiveTrackConfig } from './getConfigOverrides.ts'
import { ConfigurationSchema } from '../configuration/configurationSchema.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const WiggleDisplay = ConfigurationSchema(
  'LinearWiggleDisplay',
  {
    color: { type: 'color', defaultValue: '#f0f' },
    scaleType: { type: 'string', defaultValue: 'linear' },
    minScore: { type: 'number', defaultValue: 0 },
    maxScore: { type: 'number', defaultValue: 100 },
    showLabels: { type: 'boolean', defaultValue: true },
  },
  { explicitlyTyped: true, explicitIdentifier: 'displayId' },
)

const BasicDisplay = ConfigurationSchema(
  'LinearBasicDisplay',
  { color: { type: 'color', defaultValue: '#000' } },
  { explicitlyTyped: true, explicitIdentifier: 'displayId' },
)

const TrackConfig = ConfigurationSchema(
  'FeatureTrack',
  {
    name: { type: 'string', defaultValue: '' },
    adapter: { type: 'frozen', defaultValue: {} },
    displays: types.array(types.union(WiggleDisplay, BasicDisplay)),
  },
  { explicitIdentifier: 'trackId' },
)

function makeTrack(
  fields: Record<string, unknown>,
  displays: Record<string, unknown>[],
) {
  return TrackConfig.create(
    { trackId: 'track-1', ...fields, displays },
    { pluginManager },
  )
}

// the active display: getEffectiveTrackConfig reads `.configuration` (the live
// display config node) and `.configOverrides` (the ConfigOverrideMixin map)
function makeDisplay(
  configuration: unknown,
  configOverrides?: Record<string, unknown>,
) {
  return configOverrides
    ? { configuration, configOverrides }
    : { configuration }
}

describe('getEffectiveTrackConfig', () => {
  test('full display entry when overrides match defaults', () => {
    const track = makeTrack({}, [
      { type: 'LinearWiggleDisplay', displayId: 'track-1-display' },
    ])
    const display = makeDisplay(track.displays[0], { color: '#f0f' })
    const result = getEffectiveTrackConfig(track, display)
    expect(result.displays).toEqual([
      { type: 'LinearWiggleDisplay', displayId: 'track-1-display' },
    ])
  })

  test('merges display overrides into matching display config', () => {
    const track = makeTrack({}, [
      { type: 'LinearWiggleDisplay', displayId: 'd1' },
    ])
    const display = makeDisplay(track.displays[0], { color: '#ff0000' })
    const result = getEffectiveTrackConfig(track, display)
    expect((result.displays as any)[0].color).toBe('#ff0000')
  })

  test('preserves non-display track config properties', () => {
    const track = makeTrack(
      { name: 'My Track', adapter: { type: 'BigWigAdapter' } },
      [{ type: 'LinearWiggleDisplay', displayId: 'd1' }],
    )
    const display = makeDisplay(track.displays[0])
    const result = getEffectiveTrackConfig(track, display)
    expect(result.trackId).toBe('track-1')
    expect(result.name).toBe('My Track')
    expect(result.adapter).toEqual({ type: 'BigWigAdapter' })
  })

  test('only modifies matching display config entry', () => {
    const track = makeTrack({}, [
      { type: 'LinearWiggleDisplay', displayId: 'd1' },
      { type: 'LinearBasicDisplay', displayId: 'd2' },
    ])
    const display = makeDisplay(track.displays[0], { color: '#ff0000' })
    const result = getEffectiveTrackConfig(track, display)
    const displays = result.displays as any[]
    expect(displays[0].color).toBe('#ff0000')
    expect(displays[1].color).toBeUndefined()
  })

  test('handles multiple overridden slots', () => {
    const track = makeTrack({}, [
      { type: 'LinearWiggleDisplay', displayId: 'd1' },
    ])
    const display = makeDisplay(track.displays[0], {
      color: '#ff0000',
      scaleType: 'log',
      minScore: 0,
    })
    const result = getEffectiveTrackConfig(track, display)
    const d = (result.displays as any)[0]
    expect(d.color).toBe('#ff0000')
    expect(d.scaleType).toBe('log')
    expect(d.minScore).toBeUndefined()
  })

  test('does not include undefined override values', () => {
    const track = makeTrack({}, [
      { type: 'LinearWiggleDisplay', displayId: 'd1' },
    ])
    const display = makeDisplay(track.displays[0], { color: undefined })
    const result = getEffectiveTrackConfig(track, display)
    expect((result.displays as any)[0].color).toBeUndefined()
  })

  test('returns config as-is when no displays array', () => {
    const NoDisplays = ConfigurationSchema(
      'NoDisplaysTrack',
      { name: { type: 'string', defaultValue: '' } },
      { explicitIdentifier: 'trackId' },
    )
    const track = NoDisplays.create({ trackId: 'track-1' }, { pluginManager })
    const result = getEffectiveTrackConfig(track, makeDisplay(undefined))
    expect(result.trackId).toBe('track-1')
    expect(result.displays).toBeUndefined()
  })

  test('does not mutate the original track config', () => {
    const track = makeTrack({}, [
      { type: 'LinearWiggleDisplay', displayId: 'd1' },
    ])
    const before = JSON.stringify(track)
    getEffectiveTrackConfig(track, makeDisplay(track.displays[0], { color: '#f00' }))
    expect(JSON.stringify(track)).toBe(before)
  })

  test('skips jexl callback config slots', () => {
    const track = makeTrack({}, [
      {
        type: 'LinearWiggleDisplay',
        displayId: 'd1',
        color: "jexl:get(feature,'type')=='gene'?'blue':'black'",
      },
    ])
    const display = makeDisplay(track.displays[0], { color: '#ff0000' })
    const result = getEffectiveTrackConfig(track, display)
    const d = (result.displays as any)[0]
    expect(d.color).toBeUndefined()
    expect(d.displayId).toBe('d1')
  })

  test('includes displayId and type even when overrides match defaults', () => {
    const track = makeTrack({}, [
      { type: 'LinearWiggleDisplay', displayId: 'd1' },
    ])
    const display = makeDisplay(track.displays[0], {
      color: '#f0f',
      scaleType: 'linear',
    })
    const result = getEffectiveTrackConfig(track, display)
    const d = (result.displays as any)[0]
    expect(d.displayId).toBe('d1')
    expect(d.type).toBe('LinearWiggleDisplay')
    expect(d.color).toBeUndefined()
    expect(d.scaleType).toBeUndefined()
  })

  test('detects boolean override (e.g. showLabels toggled to false)', () => {
    const track = makeTrack({}, [
      { type: 'LinearWiggleDisplay', displayId: 'd1' },
    ])
    const display = makeDisplay(track.displays[0], { showLabels: false })
    const result = getEffectiveTrackConfig(track, display)
    expect((result.displays as any)[0].showLabels).toBe(false)
  })

  test('detects numeric override when value changes from default', () => {
    const track = makeTrack({}, [
      { type: 'LinearWiggleDisplay', displayId: 'd1' },
    ])
    const display = makeDisplay(track.displays[0], {
      minScore: 5,
      maxScore: 100,
    })
    const result = getEffectiveTrackConfig(track, display)
    const d = (result.displays as any)[0]
    expect(d.minScore).toBe(5)
    expect(d.maxScore).toBeUndefined()
  })

  test('display without configOverrides emits no overrides (mixin not composed)', () => {
    const track = makeTrack({}, [
      { type: 'LinearWiggleDisplay', displayId: 'd1' },
    ])
    const display = makeDisplay(track.displays[0])
    const result = getEffectiveTrackConfig(track, display)
    const d = (result.displays as any)[0]
    expect(d.displayId).toBe('d1')
    expect(d.color).toBeUndefined()
  })

  test('non-matching display gets type but no slot values', () => {
    const track = makeTrack({}, [
      { type: 'LinearWiggleDisplay', displayId: 'd1' },
      { type: 'LinearBasicDisplay', displayId: 'd2' },
    ])
    const display = makeDisplay(track.displays[0], { color: '#ff0000' })
    const result = getEffectiveTrackConfig(track, display)
    expect((result.displays as any[])[1]).toEqual({ type: 'LinearBasicDisplay' })
  })
})
