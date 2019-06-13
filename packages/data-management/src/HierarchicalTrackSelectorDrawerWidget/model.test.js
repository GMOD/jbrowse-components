import { generateHierarchy } from './model'

test('can generate hierarchy correctly', () => {
  const trackConfigurations = [
    {
      configId: 'zonker',
      category: { func: () => ['Bar', 'Baz'] },
    },
    { configId: 'zoo' },
    { configId: 'bee', category: { func: () => ['Bar'] } },
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
