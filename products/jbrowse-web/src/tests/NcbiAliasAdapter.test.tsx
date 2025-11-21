import { test } from 'vitest'

import { createView, doBeforeEach, expectCanvasMatch, setup } from './util'
import config from '../../test_data/cfam2/config.json'

setup()

const delay = { timeout: 50000 }
const opts = [{}, delay]

test('ncbi config', async () => {
  doBeforeEach(url => require.resolve(`../../test_data/cfam2/${url}`))
  const { findAllByTestId } = await createView(config)

  expectCanvasMatch((await findAllByTestId(/prerendered_canvas/, ...opts))[0]!)
}, 50000)
