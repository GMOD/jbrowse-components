import { screen } from '@testing-library/react'
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

test('toggle subfeature labels and verify eden.1 label appears', async () => {
  const user = userEvent.setup()
  const { view, findAllByTestId } = await createView()

  await view.navToLocString('ctgA:907..15,319')
  await user.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))
  await findAllByTestId(/^display-.*-done$/, ...opts)

  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Show...', ...opts))
  await user.click(await screen.findByText('Show subfeature labels', ...opts))

  await screen.findByText('EDEN.1', ...opts)

  const displays = await findAllByTestId(/^display-.*-done$/, ...opts)
  expectCanvasMatch(findCanvasIn(displays[0]!))
}, 50000)
