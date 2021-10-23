import { generateHierarchy } from './model'

xtest('can generate hierarchy correctly', () => {
  const trackConfigurations = [
    {
      trackId: 'zonker',
      category: { expr: { evalSync: () => ['Bar', 'Baz'] } },
    },
    { trackId: 'zoo' },
    { trackId: 'bee', category: { expr: { evalSync: () => ['Bar'] } } },
  ]
  expect(generateHierarchy(trackConfigurations)).toEqual(
    new Map([
      [
        'Bar',
        new Map([
          ['bee', trackConfigurations[2]],
          ['Baz', new Map([['zonker', trackConfigurations[0]]])],
        ]),
      ],
      ['zoo', trackConfigurations[1]],
    ]),
  )
})
