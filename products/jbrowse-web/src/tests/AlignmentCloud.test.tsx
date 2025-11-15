import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, doBeforeEach, expectCanvasMatch, hts, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 100000

async function wait(view: any, findByTestId: any) {
  // Wait for PileupDisplay to be drawn
  await waitFor(
    () => {
      expect(view.tracks[0].displays[0].PileupDisplay.drawn).toBe(true)
    },
    { timeout },
  )

  // Wait for the cloud-canvas element to appear and be rendered
  await findByTestId('cloud-canvas', {}, { timeout })
}

async function testCloud(loc: string, track: string) {
  const user = userEvent.setup()
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  const opts = [{}, { timeout }] as const
  await view.navToLocString(loc)
  await user.click(await findByTestId(hts(track), ...opts))
  await user.click(await findByTestId('track_menu_icon', ...opts))
  await user.click(await findByText('Replace lower panel with...'))
  await user.click((await findAllByText('Linked reads display'))[0]!)
  await user.click(await findByTestId('track_menu_icon', ...opts))
  await user.click((await findAllByText(/Toggle read cloud/))[0]!)
  await wait(view, findByTestId)
  expectCanvasMatch(getByTestId('cloud-canvas'))
}

test(
  'short-read cloud display',
  async () => {
    await testCloud('ctgA:1-50000', 'volvox_sv_cram')
  },
  timeout,
)

test(
  'long-read cloud display',
  async () => {
    await testCloud('ctgA:19,101..32,027', 'volvox-simple-inv.bam')
  },
  timeout,
)

test(
  'long-read cloud display, out of view pairing',
  async () => {
    await testCloud('ctgA:478..6,191', 'volvox-long-reads-sv-cram')
  },
  timeout,
)

test(
  'short-read cloud display, out of view pairing',
  async () => {
    await testCloud('ctgA:478..6,191', 'volvox_sv_cram')
  },
  timeout,
)
