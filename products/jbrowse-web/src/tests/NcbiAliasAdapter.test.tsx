import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { createView, doBeforeEach, setup } from './util'
import config from '../../test_data/cfam2/config.json'

afterEach(() => {
  cleanup()
})
setup()

beforeEach(() => {
  doBeforeEach(url => require.resolve(`../../test_data/cfam2/${url}`))
})

const delay = { timeout: 30000 }
const opts = [{}, delay]
test('ncbi config', async () => {
  const { findByTestId } = await createView(config)
  const features = await findByTestId('svgfeatures', ...opts)
  expect(features).toMatchSnapshot()
}, 30000)
