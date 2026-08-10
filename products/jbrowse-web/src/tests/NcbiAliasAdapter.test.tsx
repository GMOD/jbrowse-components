import config from '../../test_data/cfam2/config.json' with { type: 'json' }
import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findAnyDisplayPainted,
  findCanvasIn,
  setup,
} from './util.tsx'

setup()

const delay = { timeout: 50000 }

test('ncbi config', async () => {
  doBeforeEach(url => require.resolve(`../../test_data/cfam2/${url}`))
  await createView(config)

  const display = await findAnyDisplayPainted(delay)
  expectCanvasMatch(findCanvasIn(display))
}, 50000)
