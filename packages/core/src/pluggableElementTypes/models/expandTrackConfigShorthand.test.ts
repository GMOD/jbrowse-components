import {
  collectDisplayOverrides,
  mergeOverridesIntoDisplays,
} from './expandTrackConfigShorthand.ts'

// A track with a LinearVariantDisplay ('color' slot) and a ChordVariantDisplay
// ('strokeColor' slot) — slot names route settings to the right display.
const displaySlots = new Map([
  ['LinearBasicDisplay', new Set(['color', 'displayMode', 'height'])],
  ['ChordVariantDisplay', new Set(['strokeColor', 'height'])],
])

describe('collectDisplayOverrides', () => {
  test('routes a setting to every display defining that slot', () => {
    const { overrides, unknownKeys } = collectDisplayOverrides(
      { height: 100 },
      displaySlots,
    )
    expect(overrides.get('LinearBasicDisplay')).toEqual({ height: 100 })
    expect(overrides.get('ChordVariantDisplay')).toEqual({ height: 100 })
    expect(unknownKeys).toEqual([])
  })

  test('routes by slot name when displays differ (color vs strokeColor)', () => {
    const { overrides } = collectDisplayOverrides(
      { color: 'green', strokeColor: 'red' },
      displaySlots,
    )
    expect(overrides.get('LinearBasicDisplay')).toEqual({ color: 'green' })
    expect(overrides.get('ChordVariantDisplay')).toEqual({ strokeColor: 'red' })
  })

  test('reports keys no display defines', () => {
    const { overrides, unknownKeys } = collectDisplayOverrides(
      { colour: 'green' },
      displaySlots,
    )
    expect(overrides.size).toBe(0)
    expect(unknownKeys).toEqual(['colour'])
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
        ['ChordVariantDisplay', { strokeColor: 'red' }],
      ]),
      'mytrack',
    )
    expect(merged).toHaveLength(2)
    expect(merged[0]).toMatchObject({ displayId: 'd1', color: 'green' })
    expect(merged[1]).toMatchObject({
      type: 'ChordVariantDisplay',
      displayId: 'mytrack-ChordVariantDisplay',
      strokeColor: 'red',
    })
  })
})
