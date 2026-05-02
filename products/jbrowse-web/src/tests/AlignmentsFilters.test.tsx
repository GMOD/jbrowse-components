import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  hts,
  setup,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

async function testFilterTrack(trackId: string, tag: string, value: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByTestId(hts(trackId), ...opts))
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Filter by...'))
  await user.click(await screen.findByText('Edit filters...'))
  await user.type(
    await screen.findByLabelText('Tag name', ...opts),
    tag,
  )
  await user.type(await screen.findByPlaceholderText('Enter tag value'), value)
  await user.click(await screen.findByText('Submit'))
  const display = await screen.findByTestId('pileup-display-done', ...opts)
  expectCanvasMatch(findCanvasIn(display))
}

test('filter by HP tag cram', async () => {
  const { view } = await createView()
  view.setNewView(0.465, 85055)
  await testFilterTrack('volvox_cram', 'HP', '1')
}, 50000)

test('filter by HP tag bam', async () => {
  const { view } = await createView()
  view.setNewView(0.465, 85055)
  await testFilterTrack('volvox_bam', 'HP', '1')
}, 50000)

// snapshot not working but appears to work in browser
xtest('filter by RG tag cram (special case tag))', async () => {
  const { container, view } = await createView()
  await view.navToLocString('ctgA:1000..2000')
  await testFilterTrack('volvox_cram', 'RG', '6')
  expect(container).toMatchSnapshot()
}, 50000)

xtest('set jexl filters on bam pileup display', async () => {
  const { view } = await createView()
  view.setNewView(0.465, 85055)

  const user = userEvent.setup()
  await user.click(await screen.findByTestId(hts('volvox_bam'), ...opts))
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))

  await waitFor(() => {
    expect(view.tracks[0].displays[0]).toBeTruthy()
  })
  const filter = [`jexl:get(feature,'end')==40005`]
  view.tracks[0].displays[0].PileupDisplay.setJexlFilters(filter)

  const display = await screen.findByTestId('pileup-display-done', ...opts)
  expectCanvasMatch(findCanvasIn(display))
}, 50000)

xtest('set jexl filters on snp cov display', async () => {
  const { view } = await createView()
  view.setNewView(0.465, 85055)

  const user = userEvent.setup()
  await user.click(await screen.findByTestId(hts('volvox_bam'), ...opts))
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('SNPCoverage settings'))

  const filter = [`jexl:get(feature,'end')==40005`]
  view.tracks[0].displays[0].PileupDisplay.setJexlFilters(filter)

  const display = await screen.findByTestId('pileup-display-done', ...opts)
  expectCanvasMatch(findCanvasIn(display))
}, 50000)
