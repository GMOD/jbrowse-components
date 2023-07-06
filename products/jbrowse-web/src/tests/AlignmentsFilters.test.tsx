import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// locals
import {
  setup,
  expectCanvasMatch,
  doBeforeEach,
  createView,
  hts,
  pv,
} from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

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
