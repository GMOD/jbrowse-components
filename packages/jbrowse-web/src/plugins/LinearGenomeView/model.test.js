import { getConf } from '../../util/configuration'
import LinearGenomeModel from './model'

test('can instantiate a mostly empty model and read a default configuration value', () => {
  const model = LinearGenomeModel.create({
    type: 'linear',
    tracks: [{ name: 'foo track', type: 'tester' }],
  })
  expect(model.tracks[0]).toBeTruthy()
  expect(getConf(model.tracks[0], 'backgroundColor')).toBe('#eee')
})
