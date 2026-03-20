import { getEffectiveTrackConfig } from './getConfigOverrides.ts'

// Minimal mock of a config slot with getValue
function mockSlot(value: unknown) {
  return {
    getValue: () => value,
    name: 'slot',
    description: '',
    type: 'string',
    value,
  }
}

// Minimal mock of a display config model (acts like an MST config node)
function mockDisplayConf(
  slots: Record<string, unknown>,
  type = 'LinearWiggleDisplay',
) {
  const conf: Record<string, unknown> = { type }
  for (const [key, value] of Object.entries(slots)) {
    conf[key] = mockSlot(value)
  }
  return conf
}

// Build a track config mock where .displays contains live config models.
// getSnapshot(trackConfig) returns top-level fields with displays: [{}]
// (simulating MST's postProcessSnapshot stripping defaults).
function mockTrackConfig(
  fields: Record<string, unknown>,
  displayConfs: Record<string, unknown>[],
) {
  return {
    ...fields,
    displays: displayConfs,
    __snapshot: { ...fields, displays: displayConfs.map(() => ({})) },
  }
}

// Mock display model: getSnapshot returns { configuration: displayId }
function mockDisplay(
  displayConf: Record<string, unknown>,
  displayId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    configuration: displayConf,
    __snapshot: { configuration: displayId },
    ...overrides,
  }
}

jest.mock('@jbrowse/mobx-state-tree', () => ({
  getSnapshot: (obj: unknown) =>
    (obj as Record<string, unknown>).__snapshot ?? obj,
}))
jest.mock('mobx', () => ({
  toJS: (obj: unknown) => obj,
}))

describe('getEffectiveTrackConfig', () => {
  test('returns track config with full display entry when no overrides', () => {
    const dc = mockDisplayConf({ color: '#f0f' })
    const trackConfig = mockTrackConfig(
      { trackId: 'track-1', type: 'FeatureTrack' },
      [dc],
    )
    const display = mockDisplay(dc, 'track-1-display', { color: '#f0f' })

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    expect(result.displays).toEqual([
      { type: 'LinearWiggleDisplay', displayId: 'track-1-display' },
    ])
  })

  test('merges display overrides into matching display config', () => {
    const dc = mockDisplayConf({ color: '#f0f' })
    const trackConfig = mockTrackConfig({ trackId: 'track-1' }, [dc])
    const display = mockDisplay(dc, 'd1', { color: '#ff0000' })

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    expect((result.displays as any)[0].color).toBe('#ff0000')
  })

  test('preserves non-display track config properties', () => {
    const dc = mockDisplayConf({})
    const trackConfig = mockTrackConfig(
      { trackId: 'track-1', name: 'My Track', adapter: { type: 'BigWigAdapter' } },
      [dc],
    )
    const display = mockDisplay(dc, 'd1')

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    expect(result.trackId).toBe('track-1')
    expect(result.name).toBe('My Track')
    expect(result.adapter).toEqual({ type: 'BigWigAdapter' })
  })

  test('only modifies matching display config entry', () => {
    const dc1 = mockDisplayConf({ color: '#f0f' }, 'LinearWiggleDisplay')
    const dc2 = mockDisplayConf({ color: '#000' }, 'LinearBasicDisplay')
    const trackConfig = mockTrackConfig({ trackId: 'track-1' }, [dc1, dc2])
    const display = mockDisplay(dc1, 'd1', { color: '#ff0000' })

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    const displays = result.displays as any[]
    expect(displays[0].color).toBe('#ff0000')
    expect(displays[1].color).toBeUndefined()
  })

  test('handles multiple overridden slots', () => {
    const dc = mockDisplayConf({ color: '#f0f', scaleType: 'linear', minScore: 0 })
    const trackConfig = mockTrackConfig({ trackId: 'track-1' }, [dc])
    const display = mockDisplay(dc, 'd1', {
      color: '#ff0000',
      scaleType: 'log',
      minScore: 0,
    })

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    const d = (result.displays as any)[0]
    expect(d.color).toBe('#ff0000')
    expect(d.scaleType).toBe('log')
    expect(d.minScore).toBeUndefined()
  })

  test('does not include undefined display values as overrides', () => {
    const dc = mockDisplayConf({ color: '#f0f' })
    const trackConfig = mockTrackConfig({ trackId: 'track-1' }, [dc])
    const display = mockDisplay(dc, 'd1', { color: undefined })

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    expect((result.displays as any)[0].color).toBeUndefined()
  })

  test('returns config as-is when no displays array', () => {
    const dc = mockDisplayConf({})
    const trackConfig = {
      trackId: 'track-1',
      __snapshot: { trackId: 'track-1' },
    }
    const display = mockDisplay(dc, 'd1')

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    expect(result.trackId).toBe('track-1')
    expect(result.displays).toBeUndefined()
  })

  test('does not mutate the original track config', () => {
    const dc = mockDisplayConf({ color: '#f0f' })
    const trackConfig = mockTrackConfig({ trackId: 'track-1' }, [dc])
    const originalSnapshot = { ...trackConfig.__snapshot }
    const display = mockDisplay(dc, 'd1', { color: '#ff0000' })

    getEffectiveTrackConfig(trackConfig as any, display as any)
    expect(trackConfig.__snapshot).toEqual(originalSnapshot)
  })

  test('skips jexl callback slots', () => {
    const jexlSlot = {
      value: "jexl:get(feature, 'type') == 'gene' ? 'blue' : 'black'",
      isCallback: true,
      name: 'color',
      description: '',
      type: 'color',
      getValue: () => "jexl:get(feature, 'type') == 'gene' ? 'blue' : 'black'",
    }
    const dc: Record<string, unknown> = { color: jexlSlot }
    const trackConfig = mockTrackConfig({ trackId: 'track-1' }, [dc])
    const display = mockDisplay(dc, 'd1', { color: '#ff0000' })

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    const d = (result.displays as any)[0]
    expect(d.color).toBeUndefined()
    expect(d.displayId).toBe('d1')
  })

  test('includes displayId and type even when all slots match defaults', () => {
    const dc = mockDisplayConf({ color: '#f0f', scaleType: 'linear' })
    const trackConfig = mockTrackConfig({ trackId: 'track-1' }, [dc])
    const display = mockDisplay(dc, 'd1', { color: '#f0f', scaleType: 'linear' })

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    const d = (result.displays as any)[0]
    expect(d.displayId).toBe('d1')
    expect(d.type).toBe('LinearWiggleDisplay')
    expect(d.color).toBeUndefined()
    expect(d.scaleType).toBeUndefined()
  })
})
