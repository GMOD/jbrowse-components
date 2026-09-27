import { ConfigurationSchema } from '../../configuration/index.ts'
import {
  collectDisplayOverrides,
  mergeOverridesIntoDisplays,
} from './expandTrackConfigShorthand.ts'

import type {
  AnyConfigurationSchemaType,
  ConfigurationSchemaDefinition,
  RetiredSpelling,
} from '../../configuration/index.ts'

const display = (
  name: string,
  slots: ConfigurationSchemaDefinition,
  retired?: Record<string, RetiredSpelling>,
) =>
  ConfigurationSchema(name, slots, {
    explicitIdentifier: 'displayId',
    explicitlyTyped: true,
    retired,
  }) as AnyConfigurationSchemaType

// A track whose first display is the one it opens with, and a second display
// that is the only one retiring `pointSize`.
const schemas = new Map([
  [
    'FirstDisplay',
    display('FirstDisplay', { color: { type: 'color', defaultValue: 'grey' } }),
  ],
  [
    'SecondDisplay',
    display(
      'SecondDisplay',
      { size: { type: 'number', defaultValue: 2 } },
      {
        pointSize: (size: unknown) => ({ size }),
        // a lift that places nothing for a value it does not recognize
        scheme: (value: unknown) => (value === 'known' ? { size: 9 } : {}),
      },
    ),
  ],
])

test('a retired name routes to the display that retired it', () => {
  const { overrides, unknownKeys } = collectDisplayOverrides(
    { pointSize: 9 },
    schemas,
  )
  expect(unknownKeys).toEqual([])
  expect(overrides.get('SecondDisplay')).toEqual({ size: 9 })
})

test('a lift that places nothing reports the key rather than writing nothing', () => {
  const { overrides, unknownKeys } = collectDisplayOverrides(
    { scheme: 'unrecognized' },
    schemas,
  )
  expect(unknownKeys).toEqual(['scheme'])
  expect(overrides.size).toBe(0)
})

// a retired lift is display code, and one that throws refuses the value the
// way a slot's type check does instead of failing the track's load raw
test('a retired lift that throws refuses the value', () => {
  const throwing = new Map([
    ...schemas,
    [
      'ThirdDisplay',
      display(
        'ThirdDisplay',
        {},
        {
          pointSize: () => {
            throw new Error('no point sizes here')
          },
        },
      ),
    ],
  ])
  const { overrides, refused } = collectDisplayOverrides(
    { pointSize: 9 },
    throwing,
  )
  expect(refused).toEqual([])
  expect(overrides.get('SecondDisplay')).toEqual({ size: 9 })
  expect(overrides.has('ThirdDisplay')).toBe(false)
})

test('an explicit entry still wins over the members a lift answers', () => {
  const { overrides } = collectDisplayOverrides({ pointSize: 9 }, schemas)
  expect(
    mergeOverridesIntoDisplays(
      [{ type: 'SecondDisplay', displayId: 't-SecondDisplay', size: 3 }],
      overrides,
    ),
  ).toEqual([{ type: 'SecondDisplay', displayId: 't-SecondDisplay', size: 3 }])
})
