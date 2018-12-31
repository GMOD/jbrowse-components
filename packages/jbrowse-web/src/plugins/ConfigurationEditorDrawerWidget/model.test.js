// import { generateHierarchy } from './model'

// test('can generate hierarchy correctly', () => {
//   const trackConfigurations = [
//     {
//       _configId: 'zonker',
//       category: { func: () => ['Bar', 'Baz'] },
//     },
//     { _configId: 'zoo' },
//     { _configId: 'bee', category: { func: () => ['Bar'] } },
//   ]
//   expect(generateHierarchy(trackConfigurations)).toEqual({
//     Bar: {
//       bee: trackConfigurations[2],
//       Baz: { zonker: trackConfigurations[0] },
//     },
//     zoo: trackConfigurations[1],
//   })
// })
