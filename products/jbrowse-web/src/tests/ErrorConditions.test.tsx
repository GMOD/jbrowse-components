import { createViewNoWait, doBeforeEach, mockConsole } from './util.tsx'
import chromeSizesConfig from '../../test_data/404_chrom_sizes/config.json' with { type: 'json' }
import brokenTrackConfig from '../../test_data/volvox/config_broken.json' with { type: 'json' }
import wrongAssemblyTest from '../../test_data/wrong_assembly.json' with { type: 'json' }

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

test('invalid track config surfaces as a snackbar, not a crash', async () => {
  await mockConsole(async () => {
    const { view, findAllByText } = createViewNoWait(brokenTrackConfig)
    const track = view.showTrack('broken_config_demo')

    // showTrack swallows the validation error: nothing is opened and no throw
    // escapes to crash the app
    expect(track).toBeUndefined()
    expect(view.tracks).toHaveLength(0)

    await findAllByText(/invalid configuration/, {}, delay)
  })
}, 30000)
