import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  setup,
} from './util.tsx'
import config from '../../test_data/cfam2/config.json' with { type: 'json' }

setup()

const delay = { timeout: 50000 }
const opts = [{}, delay]

test('ncbi config', async () => {
  doBeforeEach(url => require.resolve(`../../test_data/cfam2/${url}`))
  const { findAllByTestId } = await createView(config)

  const displays = await findAllByTestId(/^display-.*-done$/, ...opts)
  expectCanvasMatch(findCanvasIn(displays[0]!))
}, 50000)
