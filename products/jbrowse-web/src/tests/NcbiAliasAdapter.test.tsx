import { createView, doBeforeEach, expectCanvasMatch, pv, setup } from './util'
import config from '../../test_data/cfam2/config.json'

setup()

const delay = { timeout: 50000 }
const opts = [{}, delay]

test('ncbi config', async () => {
  doBeforeEach(url => require.resolve(`../../test_data/cfam2/${url}`))
  const { findByTestId } = await createView(config)

  expectCanvasMatch(await findByTestId(pv('1..50000-0'), ...opts))
}, 50000)
