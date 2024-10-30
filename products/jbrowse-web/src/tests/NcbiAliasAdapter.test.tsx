import { createView, doBeforeEach, setup } from './util'
import config from '../../test_data/cfam2/config.json'

setup()

const delay = { timeout: 50000 }
const opts = [{}, delay]

test('ncbi config', async () => {
  doBeforeEach(url => require.resolve(`../../test_data/cfam2/${url}`))
  const { findByTestId } = await createView(config)
  const features = await findByTestId('box-test-offset-272549-0-1', ...opts)
  expect(features).toMatchSnapshot()
}, 50000)
