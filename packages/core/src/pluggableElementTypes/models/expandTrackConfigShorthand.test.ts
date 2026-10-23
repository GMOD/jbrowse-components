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
  { shorthand: 'value', writes: 'whole', closed: true },
)

// Three displays of one track: two declare `color`, one as a plain color
// slot and one as an object with a scale, and the third names its color
// `baseColor`.
const displaySchemas = new Map<string, AnyConfigurationSchemaType>([
  [
    'LinearBasicDisplay',
    ConfigurationSchema(
      'LinearBasicDisplay',
      {
        color: { type: 'color', defaultValue: 'goldenrod' },
        height: { type: 'number', defaultValue: 100 },
      },
      { retired: { legacyHeight: height => ({ height }) } },
    ),
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
      coverage: ConfigurationSchema('CoverageBand', {
        show: { type: 'boolean', defaultValue: true },
        height: { type: 'number', defaultValue: 45 },
      }),
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

const Axis = ConfigurationSchema(
  'Axis',
  {
    tree: { type: 'boolean', defaultValue: true },
    labels: { type: 'boolean', defaultValue: true },
  },
  { closed: true, retired: { showTree: tree => ({ tree }) } },
)
const AxisWithGrid = ConfigurationSchema(
  'AxisWithGrid',
  { grid: { type: 'boolean', defaultValue: false } },
  { baseConfiguration: Axis },
)
const axisSchemas = new Map<string, AnyConfigurationSchemaType>([
  ['GridDisplay', ConfigurationSchema('GridDisplay', { axis: AxisWithGrid })],
  ['GridlessDisplay', ConfigurationSchema('GridlessDisplay', { axis: Axis })],
])

describe('a namespace value splits by member across displays', () => {
  test('each display gets the members its namespace declares', () => {
    const { overrides, unknownKeys, refused } = collectDisplayOverrides(
      { axis: { tree: false, grid: true } },
      axisSchemas,
    )
    expect(overrides.get('GridDisplay')).toEqual({
      axis: { tree: false, grid: true },
    })
    expect(overrides.get('GridlessDisplay')).toEqual({ axis: { tree: false } })
    expect(unknownKeys).toEqual([])
    expect(refused).toEqual([])
  })

  test('a retired member name still counts as declared', () => {
    const { overrides } = collectDisplayOverrides(
      { axis: { showTree: false, grid: true } },
      axisSchemas,
    )
    expect(overrides.get('GridlessDisplay')).toEqual({
      axis: { showTree: false },
    })
  })

  test('a gridless track still takes the members it declares', () => {
    const { overrides, unknownKeys, refused } = collectDisplayOverrides(
      { axis: { grid: true, tree: false } },
      new Map([['GridlessDisplay', axisSchemas.get('GridlessDisplay')!]]),
    )
    expect(overrides.get('GridlessDisplay')).toEqual({ axis: { tree: false } })
    expect(unknownKeys).toEqual(['axis.grid'])
    expect(refused).toEqual([])
  })

  test('a member no display declares is reported', () => {
    const { overrides, unknownKeys } = collectDisplayOverrides(
      { axis: { tree: false, gird: true } },
      axisSchemas,
    )
    expect(overrides.get('GridDisplay')).toEqual({ axis: { tree: false } })
    expect(unknownKeys).toEqual(['axis.gird'])
  })

  test('a declared member every display refuses is refused', () => {
    const { overrides, refused } = collectDisplayOverrides(
      { axis: { tree: 'no', grid: true } },
      axisSchemas,
    )
    expect(overrides.size).toBe(0)
    expect(refused.map(r => r.key)).toEqual(['axis'])
  })
})

describe('mergeOverridesIntoDisplays', () => {
  test('a display with no entry gets none', () => {
    expect(
      mergeOverridesIntoDisplays(
        [],
        new Map([['LinearBasicDisplay', { color: 'green' }]]),
        displaySchemas,
      ),
    ).toEqual([])
  })

  test('explicit display entry props win over shorthand', () => {
    const merged = mergeOverridesIntoDisplays(
      [{ type: 'LinearBasicDisplay', displayId: 'custom', color: 'red' }],
      new Map([['LinearBasicDisplay', { color: 'green', height: 20 }]]),
      displaySchemas,
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

  test('merges into the matching entry and adds none for the rest', () => {
    expect(
      mergeOverridesIntoDisplays(
        [{ type: 'LinearBasicDisplay', displayId: 'd1' }],
        new Map([
          ['LinearBasicDisplay', { color: 'green' }],
          ['LinearAlignmentsDisplay', { baseColor: 'red' }],
        ]),
        displaySchemas,
      ),
    ).toEqual([{ type: 'LinearBasicDisplay', displayId: 'd1', color: 'green' }])
  })

  test("an entry's retired spelling still beats the shorthand's current one", () => {
    expect(
      mergeOverridesIntoDisplays(
        [{ type: 'LinearBasicDisplay', legacyHeight: 9 }],
        new Map([['LinearBasicDisplay', { height: 3 }]]),
        displaySchemas,
      ),
    ).toEqual([{ type: 'LinearBasicDisplay', height: 9 }])
  })

  test('a namespace merges member by member, a channel is replaced whole', () => {
    expect(
      mergeOverridesIntoDisplays(
        [
          { type: 'LinearAlignmentsDisplay', coverage: { show: false } },
          { type: 'LinearManhattanDisplay', color: { value: 'red' } },
        ],
        new Map([
          ['LinearAlignmentsDisplay', { coverage: { height: 80 } }],
          [
            'LinearManhattanDisplay',
            { color: { value: 'green', scale: 'ld' } },
          ],
        ]),
        displaySchemas,
      ),
    ).toEqual([
      {
        type: 'LinearAlignmentsDisplay',
        coverage: { show: false, height: 80 },
      },
      { type: 'LinearManhattanDisplay', color: { value: 'red' } },
    ])
  })
})
