import { waitFor } from '@testing-library/dom'

import { createView, doBeforeEach, setup } from './util'
import config from '../../test_data/cfam2/config.json'

setup()

const delay = { timeout: 50000 }
const opts = [{}, delay]

test('ncbi config', async () => {
  doBeforeEach(url => require.resolve(`../../test_data/cfam2/${url}`))
  const { queryAllByTestId, getAllByTestId } = await createView(config)

  await waitFor(() => {
    expect(queryAllByTestId('svgfeatures').length).toBe(2)
  }, delay)
  const features = getAllByTestId('svgfeatures', ...opts)
  expect(features).toMatchSnapshot()
}, 50000)
