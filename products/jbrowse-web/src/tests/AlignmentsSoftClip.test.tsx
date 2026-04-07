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

test('opens the track menu and enables soft clipping', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  // position near end of aligned reads (1-2701) where soft clips extend
  view.setNewView(0.02, 134500)

  await user.click(
    await screen.findByTestId(hts('volvox-long-reads-sv-bam'), ...opts),
  )
  // wait for initial render before toggling soft clipping
  await screen.findByTestId('pileup-display-done', ...opts)
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Show...'))
  await user.click(await screen.findByText('Show soft clipping'))

  // wait for data to be re-fetched with soft clipping enabled
  await waitFor(
    () => {
      const d = view.tracks[0]?.displays[0] as any
      expect(d?.rpcDataMap?.size).toBeGreaterThan(0)
    },
    { timeout: 30000 },
  )

  // slightly higher threshold for fonts
  const display = await screen.findByTestId('pileup-display-done', ...opts)
  expectCanvasMatch(findCanvasIn(display), 0.05)
}, 60000)
