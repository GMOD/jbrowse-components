import { createViewNoWait, doBeforeEach, mockConsole } from './util'
import chromeSizesConfig from '../../test_data/404_chrom_sizes/config.json'
import wrongAssemblyTest from '../../test_data/wrong_assembly.json'

const delay = { timeout: 30000 }

beforeEach(() => {
  doBeforeEach()
})

test('404 sequence file', async () => {
  await mockConsole(async () => {
    const { findAllByText } = createViewNoWait(chromeSizesConfig)
    await findAllByText(
      /HTTP 404 fetching grape.chrom.sizes.nonexist/,
      {},
      delay,
    )
  })
}, 30000)

test('wrong assembly', async () => {
  await mockConsole(async () => {
    const { view, findAllByText } = createViewNoWait(wrongAssemblyTest)
    view.showTrack('volvox_wrong_assembly')
    await findAllByText(/does not match/, {}, delay)
  })
}, 30000)
