import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, doBeforeEach, expectCanvasMatch, hts, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 60000

async function wait(view: any, findByTestId: any) {
  // Wait for PileupDisplay to be drawn
  await waitFor(
    () => {
      expect(view.tracks[0].displays[0].PileupDisplay.drawn).toBe(true)
    },
    { timeout },
  )

  // Wait for the arc-canvas element to appear and be rendered
  await findByTestId('arc-canvas', {}, { timeout })

  // Wait for the canvas to be fully populated
  await waitFor(
    () => {
      const canvas = document.querySelector(
        '[data-testid="arc-canvas"]',
      ) as HTMLCanvasElement
      expect(canvas).toBeDefined()
      // Check that the canvas has been drawn to (not blank)
      const ctx = canvas?.getContext('2d')
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height)
      const hasContent = imageData?.data.some(pixel => pixel !== 0)
      expect(hasContent).toBe(true)
    },
    { timeout },
  )
}

async function testArc(loc: string, track: string) {
  const user = userEvent.setup()
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  const opts = [{}, { timeout }] as const
  await view.navToLocString(loc)
  await user.click(await findByTestId(hts(track), ...opts))
  await user.click(await findByTestId('track_menu_icon', ...opts))
  await user.click(await findByText('Replace lower panel with...'))
  await user.click((await findAllByText('Read arc display'))[0]!)
  await wait(view, findByTestId)
  expectCanvasMatch(getByTestId('arc-canvas'))
}

test('short-read arc display', async () => {
  await testArc('ctgA:1-50000', 'volvox_sv_cram')
}, 60000)

test('long-read arc display', async () => {
  await testArc('ctgA:19,101..32,027', 'volvox-simple-inv.bam')
}, 60000)

test('long-read arc display, out of view pairing', async () => {
  await testArc('ctgA:478..6,191', 'volvox-long-reads-sv-cram')
}, 60000)

test('short-read arc display, out of view pairing', async () => {
  await testArc('ctgA:478..6,191', 'volvox_sv_cram')
}, 60000)
