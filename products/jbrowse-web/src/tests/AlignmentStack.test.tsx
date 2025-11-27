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

const timeout = 60000
async function wait(view: any, findByTestId: any) {
  console.log('DEBUG: Starting wait, checking PileupDisplay.drawn')
  // Wait for PileupDisplay to be drawn
  await waitFor(
    () => {
      const display = view.tracks[0]?.displays[0]?.PileupDisplay
      console.log('DEBUG: PileupDisplay exists:', !!display, 'drawn:', display?.drawn)
      const drawn = display?.drawn
      expect(drawn).toBe(true)
    },
    { timeout },
  )
  console.log('DEBUG: PileupDisplay.drawn is true, now waiting for stack-canvas')

  // Wait for the stack-canvas element to appear and be rendered
  await findByTestId('stack-canvas', {}, { timeout })
  console.log('DEBUG: stack-canvas found')
}

async function testStack(loc: string, track: string) {
  console.log('DEBUG: testStack starting, loc:', loc, 'track:', track)
  const user = userEvent.setup()
  const { view, findByTestId, findAllByText, findByText } = await createView()
  console.log('DEBUG: view created')
  const opts = [{}, { timeout }] as const

  await view.navToLocString(loc)
  console.log('DEBUG: navigated to location')
  await user.click(await findByTestId(hts(track), ...opts))
  console.log('DEBUG: clicked track')
  await user.click(await findByTestId('track_menu_icon', ...opts))
  console.log('DEBUG: clicked track menu icon')
  await user.click(await findByText('Replace lower panel with...'))
  console.log('DEBUG: clicked Replace lower panel')
  await user.click((await findAllByText('Linked reads display'))[0]!)
  console.log('DEBUG: clicked Linked reads display, now waiting...')
  await wait(view, findByTestId)
  console.log('DEBUG: wait complete')
  await new Promise(res => setTimeout(res, 2000))
  expectCanvasMatch(await findByTestId('stack-canvas'))
  console.log('DEBUG: test complete')
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
