import { types } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from '../../configuration/index.ts'
import {
  collectDisplayOverrides,
  mergeOverridesIntoDisplays,
} from './expandTrackConfigShorthand.ts'

import type { AnyConfigurationSchemaType } from '../../configuration/index.ts'

const ScaledColor = ConfigurationSchema(
  'ScaledColor',
  {
    value: { type: 'color', defaultValue: 'goldenrod' },
    scale: {
      type: 'maybeStringEnum',
      model: types.enumeration('Scale', ['none', 'ld']),
    },
  },
  { shorthand: 'value', closed: true },
)

// Three displays of one track: two declare `color`, one as a plain colour
// slot and one as an object with a scale, and the third names its colour
// `baseColor`.
const displaySchemas = new Map<string, AnyConfigurationSchemaType>([
  [
    'LinearBasicDisplay',
    ConfigurationSchema('LinearBasicDisplay', {
      color: { type: 'color', defaultValue: 'goldenrod' },
      height: { type: 'number', defaultValue: 100 },
    }),
  ],
  [
    'LinearManhattanDisplay',
    ConfigurationSchema('LinearManhattanDisplay', { color: ScaledColor }),
  ],
  [
    'LinearAlignmentsDisplay',
    ConfigurationSchema('LinearAlignmentsDisplay', {
      baseColor: { type: 'color', defaultValue: 'goldenrod' },
      height: { type: 'number', defaultValue: 100 },
    }),
  ],
])

describe('collectDisplayOverrides', () => {
  test('routes a setting to every display defining that slot', () => {
    const { overrides, unknownKeys } = collectDisplayOverrides(
      { height: 100 },
      displaySchemas,
    )
    expect(overrides.get('LinearBasicDisplay')).toEqual({ height: 100 })
    expect(overrides.get('LinearAlignmentsDisplay')).toEqual({ height: 100 })
    expect(unknownKeys).toEqual([])
  })

  test('routes by slot name when displays differ (color vs baseColor)', () => {
    const { overrides } = collectDisplayOverrides(
      { color: 'green', baseColor: 'red' },
      displaySchemas,
    )
    expect(overrides.get('LinearBasicDisplay')).toEqual({ color: 'green' })
    expect(overrides.get('LinearManhattanDisplay')).toEqual({ color: 'green' })
    expect(overrides.get('LinearAlignmentsDisplay')).toEqual({
      baseColor: 'red',
    })
  })

  test('routes a value only to the displays whose slot takes it', () => {
    const { overrides, refused } = collectDisplayOverrides(
      { color: { scale: 'ld' } },
      displaySchemas,
    )
    expect([...overrides.keys()]).toEqual(['LinearManhattanDisplay'])
    expect(refused).toEqual([])
  })

  test('reports a value every declaring display refuses, with each reason', () => {
    const { overrides, refused } = collectDisplayOverrides(
      { color: { scale: 'linear' } },
      displaySchemas,
    )
    expect(overrides.size).toBe(0)
    expect(refused).toEqual([
      {
        key: 'color',
        reasons: [
          expect.stringMatching(/^LinearBasicDisplay: .*color slot/),
          expect.stringMatching(/^LinearManhattanDisplay: /),
        ],
      },
    ])
  })

  test('reports keys no display defines', () => {
    const { overrides, unknownKeys } = collectDisplayOverrides(
      { colour: 'green' },
      displaySchemas,
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
        ['LinearAlignmentsDisplay', { baseColor: 'red' }],
      ]),
      'mytrack',
    )
    expect(merged).toHaveLength(2)
    expect(merged[0]).toMatchObject({ displayId: 'd1', color: 'green' })
    expect(merged[1]).toMatchObject({
      type: 'LinearAlignmentsDisplay',
      displayId: 'mytrack-LinearAlignmentsDisplay',
      baseColor: 'red',
    })
  })
})
