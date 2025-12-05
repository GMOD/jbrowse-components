import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  createView,
  expectBlocksetCanvasMatch,
  expectCanvasMatch,
  pv,
  selectTrackMenuOption,
  setupTest,
} from './util'

setupTest()

const delay = { timeout: 30000 }
const opts = [{}, delay] as const

async function testFilterTrack(
  trackId: string,
  tag: string,
  value: string,
  key: string,
) {
  const user = userEvent.setup()
  await selectTrackMenuOption(user, trackId, ['Filter by...'])
  await user.type(
    await screen.findByPlaceholderText('Enter tag name', ...opts),
    tag,
  )
  await user.type(await screen.findByPlaceholderText('Enter tag value'), value)
  await user.click(await screen.findByText('Submit'))
  await screen.findAllByTestId(`pileup-overlay-normal-${tag}`, ...opts)
  await expectBlocksetCanvasMatch('pileup', pv(key), 30000)
}

test('filter by HP tag cram', async () => {
  const { view } = await createView()
  view.setNewView(0.465, 85055)
  await testFilterTrack('volvox_cram', 'HP', '1', '39805..40176-0')
}, 50000)

test('filter by HP tag bam', async () => {
  const { view } = await createView()
  view.setNewView(0.465, 85055)
  await testFilterTrack('volvox_bam', 'HP', '1', '39805..40176-0')
}, 50000)

// snapshot not working but appears to work in browser
xtest('filter by RG tag cram (special case tag))', async () => {
  const { container, view } = await createView()
  await view.navToLocString('ctgA:1000..2000')
  await testFilterTrack('volvox_cram', 'RG', '6', '1002..2002-0')
  expect(container).toMatchSnapshot()
}, 50000)

test('set jexl filters on bam pileup display', async () => {
  const { view } = await createView()
  view.setNewView(0.465, 85055)

  const user = userEvent.setup()
  await selectTrackMenuOption(user, 'volvox_bam', ['Pileup display'])

  const filter = [`jexl:get(feature,'end')==40005`]
  view.tracks[0].displays[0].setJexlFilters(filter)

  expectCanvasMatch(await screen.findByTestId(pv('39805..40176-0'), ...opts))
}, 50000)

test('set jexl filters on snp cov display', async () => {
  const { view } = await createView()
  view.setNewView(0.465, 85055)

  const user = userEvent.setup()
  await selectTrackMenuOption(user, 'volvox_bam', ['SNPCoverage display'])

  const filter = [`jexl:get(feature,'end')==40005`]
  view.tracks[0].displays[0].setJexlFilters(filter)

  expectCanvasMatch(await screen.findByTestId(pv('39805..40176-0'), ...opts))
}, 50000)
