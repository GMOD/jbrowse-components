import { createView, setupTest, waitForCanvasSnapshot } from './util'
import config from '../../test_data/cfam2/config.json'

setupTest(url => require.resolve(`../../test_data/cfam2/${url}`))

test('ncbi config', async () => {
  const { findAllByTestId } = await createView(config)
  await waitForCanvasSnapshot(findAllByTestId, 50000)
}, 50000)
