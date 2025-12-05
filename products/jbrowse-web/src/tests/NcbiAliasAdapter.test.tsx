import { createView, expectCanvasMatch, setupTest } from './util'
import config from '../../test_data/cfam2/config.json'

setupTest(url => require.resolve(`../../test_data/cfam2/${url}`))

const delay = { timeout: 50000 }
const opts = [{}, delay]

test('ncbi config', async () => {
  const { findAllByTestId } = await createView(config)

  expectCanvasMatch((await findAllByTestId(/prerendered_canvas/, ...opts))[0]!)
}, 50000)
