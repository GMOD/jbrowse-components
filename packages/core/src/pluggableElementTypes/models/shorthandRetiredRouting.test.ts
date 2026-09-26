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

// Without this the created entry is appended in the order the settings were
// written, so a setting only the second display takes makes it the track's
// first display — the one a view opens.
test('a created entry keeps the track type’s display order', () => {
  const { overrides } = collectDisplayOverrides({ pointSize: 9 }, schemas)
  expect(
    mergeOverridesIntoDisplays([], overrides, 't').map(d => d.type),
  ).toEqual(['SecondDisplay'])

  const both = collectDisplayOverrides(
    { pointSize: 9, color: 'red' },
    schemas,
  ).overrides
  expect(mergeOverridesIntoDisplays([], both, 't').map(d => d.type)).toEqual([
    'FirstDisplay',
    'SecondDisplay',
  ])
})

test('an explicit entry still wins over the members a lift answers', () => {
  const { overrides } = collectDisplayOverrides({ pointSize: 9 }, schemas)
  expect(
    mergeOverridesIntoDisplays(
      [{ type: 'SecondDisplay', displayId: 't-SecondDisplay', size: 3 }],
      overrides,
      't',
    ),
  ).toEqual([{ type: 'SecondDisplay', displayId: 't-SecondDisplay', size: 3 }])
})

test('a retired name with no replacement is refused, naming it', () => {
  const { refused } = collectDisplayOverrides(
    { partitionField: 'sample' },
    new Map([
      ['OnlyDisplay', display('OnlyDisplay', {}, { partitionField: '`rows`' })],
    ]),
  )
  expect(refused).toEqual([
    {
      key: 'partitionField',
      reasons: ['OnlyDisplay: `partitionField` is `rows`'],
    },
  ])
})
