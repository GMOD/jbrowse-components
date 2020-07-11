import { generateHierarchy } from './model'

test('can generate hierarchy correctly', () => {
  const trackConfigurations = [
    {
      trackId: 'zonker',
      category: { func: () => ['Bar', 'Baz'] },
    },
    { trackId: 'zoo' },
    { trackId: 'bee', category: { func: () => ['Bar'] } },
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
