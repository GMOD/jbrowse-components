import { cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, doBeforeEach, expectCanvasMatch, hts, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

afterEach(() => {
  cleanup()
})

const timeout = 20000
async function wait(view: any, findByTestId: any) {
  // Wait for PileupDisplay to be drawn
  await waitFor(
    () => {
      const drawn = view.tracks[0].displays[0].PileupDisplay.drawn
      expect(drawn).toBe(true)
    },
    { timeout },
  )

  // Wait for the stack-canvas element to appear and be rendered
  await findByTestId('stack-canvas', {}, { timeout })
}

async function testStack(loc: string, track: string) {
  const user = userEvent.setup()
  const { view, findByTestId, findAllByText, findByText } = await createView()
  const opts = [{}, { timeout }] as const

  await view.navToLocString(loc)

  await user.click(await findByTestId(hts(track), ...opts))

  await user.click(await findByTestId('track_menu_icon', ...opts))

  await user.click(await findByText('Replace lower panel with...'))

  // Add a small delay to let the submenu render
  await new Promise(resolve => setTimeout(resolve, 100))

  await user.click((await findAllByText('Linked reads display'))[0]!)

  // Wait for the menu to close
  await new Promise(resolve => setTimeout(resolve, 100))

  await wait(view, findByTestId)

  expectCanvasMatch(await findByTestId('stack-canvas'))
}

test(
  'short-read stack display',
  async () => {
    await testStack('ctgA:1-50000', 'volvox_sv_cram')
  },
  timeout,
)

test(
  'long-read stack display',
  async () => {
    await testStack('ctgA:19,101..32,027', 'volvox-simple-inv.bam')
  },
  timeout,
)

test(
  'long-read stack display, out of view pairing',
  async () => {
    await testStack('ctgA:478..6,191', 'volvox-long-reads-sv-cram')
  },
  timeout,
)

test(
  'short-read stack display, out of view pairing',
  async () => {
    await testStack('ctgA:478..6,191', 'volvox_sv_cram')
  },
  timeout,
)

test(
  'short-read stack display at ctgA:33,623..35,216',
  async () => {
    await testStack('ctgA:33,623..35,216', 'volvox_sv_cram')
  },
  timeout,
)
