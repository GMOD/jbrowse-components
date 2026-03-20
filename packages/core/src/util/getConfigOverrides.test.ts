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

// Minimal mock of a config model (acts like an MST node for readConfObject)
function mockDisplayConf(
  slots: Record<string, unknown>,
  displayId: string,
) {
  const conf: Record<string, unknown> = { displayId: mockSlot(displayId) }
  for (const [key, value] of Object.entries(slots)) {
    conf[key] = mockSlot(value)
  }
  return conf
}

// Mock getSnapshot behavior — we need to mock the module
jest.mock('@jbrowse/mobx-state-tree', () => ({
  getSnapshot: (obj: unknown) => obj,
}))

describe('getEffectiveTrackConfig', () => {
  test('returns track config unchanged when display has no overrides', () => {
    const trackConfig = {
      trackId: 'track-1',
      type: 'FeatureTrack',
      displays: [
        { type: 'LinearWiggleDisplay', displayId: 'track-1-display', color: '#f0f' },
      ],
    }
    const display = {
      configuration: mockDisplayConf({ color: '#f0f' }, 'track-1-display'),
      color: '#f0f',
    }

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    expect(result.displays).toEqual(trackConfig.displays)
  })

  test('merges display overrides into matching display config', () => {
    const trackConfig = {
      trackId: 'track-1',
      displays: [
        { type: 'LinearWiggleDisplay', displayId: 'track-1-display', color: '#f0f' },
      ],
    }
    const display = {
      configuration: mockDisplayConf({ color: '#f0f' }, 'track-1-display'),
      color: '#ff0000',
    }

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    expect((result.displays as any)[0].color).toBe('#ff0000')
  })

  test('preserves non-display track config properties', () => {
    const trackConfig = {
      trackId: 'track-1',
      name: 'My Track',
      adapter: { type: 'BigWigAdapter' },
      displays: [
        { type: 'LinearWiggleDisplay', displayId: 'd1' },
      ],
    }
    const display = {
      configuration: mockDisplayConf({}, 'd1'),
    }

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    expect(result.trackId).toBe('track-1')
    expect(result.name).toBe('My Track')
    expect(result.adapter).toEqual({ type: 'BigWigAdapter' })
  })

  test('only modifies matching display config entry', () => {
    const trackConfig = {
      trackId: 'track-1',
      displays: [
        { type: 'LinearWiggleDisplay', displayId: 'd1', color: '#f0f' },
        { type: 'LinearBasicDisplay', displayId: 'd2', color: '#000' },
      ],
    }
    const display = {
      configuration: mockDisplayConf({ color: '#f0f' }, 'd1'),
      color: '#ff0000',
    }

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    const displays = result.displays as any[]
    expect(displays[0].color).toBe('#ff0000')
    expect(displays[1].color).toBe('#000')
  })

  test('handles multiple overridden slots', () => {
    const trackConfig = {
      trackId: 'track-1',
      displays: [
        {
          type: 'LinearWiggleDisplay',
          displayId: 'd1',
          color: '#f0f',
          scaleType: 'linear',
          minScore: 0,
        },
      ],
    }
    const display = {
      configuration: mockDisplayConf(
        { color: '#f0f', scaleType: 'linear', minScore: 0 },
        'd1',
      ),
      color: '#ff0000',
      scaleType: 'log',
      minScore: 0,
    }

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    const d = (result.displays as any)[0]
    expect(d.color).toBe('#ff0000')
    expect(d.scaleType).toBe('log')
    expect(d.minScore).toBe(0)
  })

  test('does not include undefined display values as overrides', () => {
    const trackConfig = {
      trackId: 'track-1',
      displays: [
        { type: 'LinearWiggleDisplay', displayId: 'd1', color: '#f0f' },
      ],
    }
    const display = {
      configuration: mockDisplayConf({ color: '#f0f' }, 'd1'),
      color: undefined,
    }

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    expect((result.displays as any)[0].color).toBe('#f0f')
  })

  test('returns config as-is when no displays array', () => {
    const trackConfig = { trackId: 'track-1' }
    const display = {
      configuration: mockDisplayConf({}, 'd1'),
    }

    const result = getEffectiveTrackConfig(trackConfig as any, display as any)
    expect(result).toEqual(trackConfig)
  })

  test('does not mutate the original track config', () => {
    const trackConfig = {
      trackId: 'track-1',
      displays: [
        { type: 'LinearWiggleDisplay', displayId: 'd1', color: '#f0f' },
      ],
    }
    const display = {
      configuration: mockDisplayConf({ color: '#f0f' }, 'd1'),
      color: '#ff0000',
    }

    getEffectiveTrackConfig(trackConfig as any, display as any)
    expect((trackConfig.displays as any)[0].color).toBe('#f0f')
  })
})
