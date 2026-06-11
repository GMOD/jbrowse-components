import {
  collectShorthandOverrides,
  matchViewKey,
  mergeOverridesIntoDisplays,
} from './expandTrackConfigShorthand.ts'

import type { TrackDisplayInfo } from './expandTrackConfigShorthand.ts'

// A FeatureTrack-like layout: one LinearGenomeView display with a `color` slot,
// plus a second view to exercise disambiguation.
const info: TrackDisplayInfo = {
  trackSlots: new Set(['name', 'assemblyNames', 'adapter', 'displays']),
  displaySlots: new Map([
    ['LinearBasicDisplay', new Set(['color', 'displayMode', 'height'])],
    ['CircularChordDisplay', new Set(['color', 'height'])],
  ]),
  viewToDisplays: new Map([
    ['LinearGenomeView', ['LinearBasicDisplay']],
    ['CircularView', ['CircularChordDisplay']],
  ]),
  viewAbbreviations: new Map([['CircularView', 'cgv']]),
}

describe('matchViewKey', () => {
  const views = [
    { name: 'LinearGenomeView' },
    { name: 'CircularView', abbreviation: 'cgv' },
  ]
  test('matches acronym', () => {
    expect(matchViewKey('lgv', views)).toBe('LinearGenomeView')
    expect(matchViewKey('cv', views)).toBe('CircularView')
  })
  test('matches declared abbreviation', () => {
    expect(matchViewKey('cgv', views)).toBe('CircularView')
  })
  test('matches exact and lowercased name', () => {
    expect(matchViewKey('LinearGenomeView', views)).toBe('LinearGenomeView')
    expect(matchViewKey('lineargenomeview', views)).toBe('LinearGenomeView')
  })
  test('returns undefined for non-views', () => {
    expect(matchViewKey('color', views)).toBeUndefined()
  })
})

describe('collectShorthandOverrides', () => {
  test('flat display slot forwards to every display defining it', () => {
    const { overrides, consumed, unknownKeys } = collectShorthandOverrides(
      { trackId: 't', type: 'FeatureTrack', color: 'green' },
      info,
    )
    expect(overrides.get('LinearBasicDisplay')).toEqual({ color: 'green' })
    expect(overrides.get('CircularChordDisplay')).toEqual({ color: 'green' })
    expect(consumed.has('color')).toBe(true)
    expect(unknownKeys).toEqual([])
  })

  test('flat slot only forwards to displays that define it', () => {
    const { overrides } = collectShorthandOverrides({ displayMode: 'collapse' }, info)
    expect(overrides.get('LinearBasicDisplay')).toEqual({ displayMode: 'collapse' })
    expect(overrides.has('CircularChordDisplay')).toBe(false)
  })

  test('view-scoped object targets the primary display for that view', () => {
    const { overrides, consumed } = collectShorthandOverrides(
      { lgv: { color: 'green' }, cgv: { color: 'blue' } },
      info,
    )
    expect(overrides.get('LinearBasicDisplay')).toEqual({ color: 'green' })
    expect(overrides.get('CircularChordDisplay')).toEqual({ color: 'blue' })
    expect(consumed.has('lgv')).toBe(true)
    expect(consumed.has('cgv')).toBe(true)
  })

  test('reserved and track-slot keys are left alone', () => {
    const { overrides, consumed, unknownKeys } = collectShorthandOverrides(
      { trackId: 't', type: 'FeatureTrack', name: 'My track', adapter: {} },
      info,
    )
    expect(overrides.size).toBe(0)
    expect(consumed.size).toBe(0)
    expect(unknownKeys).toEqual([])
  })

  test('unrecognized keys are reported, not consumed', () => {
    const { consumed, unknownKeys } = collectShorthandOverrides({ colour: 'green' }, info)
    expect(unknownKeys).toEqual(['colour'])
    expect(consumed.has('colour')).toBe(false)
  })

  test('scalar value for a view-acronym key falls through to slot/unknown', () => {
    // 'lgv' as a scalar is not a view-scoped object; no slot named 'lgv' → unknown
    const { unknownKeys } = collectShorthandOverrides({ lgv: 'green' }, info)
    expect(unknownKeys).toEqual(['lgv'])
  })
})

describe('mergeOverridesIntoDisplays', () => {
  test('creates a display entry with derived displayId', () => {
    const merged = mergeOverridesIntoDisplays(
      [],
      new Map([['LinearBasicDisplay', { color: 'green' }]]),
      'mytrack',
    )
    expect(merged).toEqual([
      {
        type: 'LinearBasicDisplay',
        displayId: 'mytrack-LinearBasicDisplay',
        color: 'green',
      },
    ])
  })

  test('explicit display entry props win over shorthand', () => {
    const merged = mergeOverridesIntoDisplays(
      [{ type: 'LinearBasicDisplay', displayId: 'custom', color: 'red' }],
      new Map([['LinearBasicDisplay', { color: 'green', height: 20 }]]),
      'mytrack',
    )
    expect(merged).toEqual([
      {
        type: 'LinearBasicDisplay',
        displayId: 'custom',
        color: 'red',
        height: 20,
      },
    ])
  })

  test('merges into matching entry and appends non-matching overrides', () => {
    const merged = mergeOverridesIntoDisplays(
      [{ type: 'LinearBasicDisplay', displayId: 'd1' }],
      new Map([
        ['LinearBasicDisplay', { color: 'green' }],
        ['CircularChordDisplay', { color: 'blue' }],
      ]),
      'mytrack',
    )
    expect(merged).toHaveLength(2)
    expect(merged[0]).toMatchObject({ displayId: 'd1', color: 'green' })
    expect(merged[1]).toMatchObject({
      type: 'CircularChordDisplay',
      displayId: 'mytrack-CircularChordDisplay',
      color: 'blue',
    })
  })
})
