import { createView, doBeforeEach } from './util'
import chromeSizesConfig from '../../test_data/config_chrom_sizes_test.json'
import wrongAssemblyTest from '../../test_data/wrong_assembly.json'

const delay = { timeout: 15000 }

beforeEach(() => {
  doBeforeEach()
})

test('404 sequence file', async () => {
  console.error = jest.fn()
  const { findAllByText } = createView(chromeSizesConfig)
  await findAllByText(/HTTP 404 fetching grape.chrom.sizes.nonexist/)
})

test('wrong assembly', async () => {
  const { view, findAllByText } = createView(wrongAssemblyTest)
  view.showTrack('volvox_wrong_assembly')
  await findAllByText(/does not match/, {}, delay)
}, 15000)
