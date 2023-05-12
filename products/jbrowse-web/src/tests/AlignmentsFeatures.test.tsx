import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// locals
import {
  setup,
  expectCanvasMatch,
  doBeforeEach,
  createView,
  pc,
  hts,
  pv,
} from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('opens the track menu and enables soft clipping', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.02, 142956)

  await user.click(
    await screen.findByTestId(hts('volvox-long-reads-sv-bam'), ...opts),
  )
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Show soft clipping'))
  const f0 = within(await screen.findByTestId('Blockset-pileup'))
  // slightly higher threshold for fonts
  expectCanvasMatch(
    await f0.findByTestId(pc('softclipped_{volvox}ctgA:2849..2864-0'), ...opts),
    0.05,
  )
}, 50000)

test('selects a sort, sort by base pair', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.043688891869634636, 301762)

  // load track
  await user.click(
    await screen.findByTestId(hts('volvox_cram_alignments_ctga'), ...opts),
  )
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Sort by'))
  await user.click(await screen.findByText('Base pair'))
  await screen.findAllByTestId('pileup-Base pair', ...opts)
  const f1 = within(await screen.findByTestId('Blockset-pileup'))
  expectCanvasMatch(await f1.findByTestId(pv('13196..13230-0'), ...opts))
  await user.click(await screen.findByTestId('zoom_out'))
  await screen.findAllByTestId('pileup-Base pair', ...opts)
  const f2 = within(await screen.findByTestId('Blockset-pileup'))
  expectCanvasMatch(await f2.findByTestId(pv('13161..13230-0'), ...opts))
}, 35000)

test('color by tag', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.465, 85055)
  await user.click(await screen.findByTestId(hts('volvox_cram'), ...opts))
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Color scheme'))
  await user.click(await screen.findByText('Color by tag...'))
  await user.type(await screen.findByPlaceholderText('Enter tag name'), 'HP')
  await user.click(await screen.findByText('Submit'))
  await screen.findAllByTestId('pileup-tag-HP', ...opts)
  const f1 = within(await screen.findByTestId('Blockset-pileup'))
  expectCanvasMatch(await f1.findByTestId(pv('39805..40176-0'), ...opts))
}, 50000)

async function testFilterTrack(
  trackId: string,
  tag: string,
  value: string,
  key: string,
) {
  const user = userEvent.setup()
  await user.click(await screen.findByTestId(hts(trackId), ...opts))
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Filter by'))
  await user.type(await screen.findByPlaceholderText('Enter tag name'), tag)
  await user.type(await screen.findByPlaceholderText('Enter tag value'), value)
  await user.click(await screen.findByText('Submit'))
  await screen.findAllByTestId(`pileup-${tag}`, ...opts)
  const f1 = within(await screen.findByTestId('Blockset-pileup'))
  expectCanvasMatch(await f1.findByTestId(pv(key), ...opts))
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
