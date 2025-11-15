import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, doBeforeEach, expectCanvasMatch, hts, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 20000
async function wait(view: any) {
  // Wait for PileupDisplay to be drawn
  await waitFor(
    () => {
      expect(view.tracks[0].displays[0].PileupDisplay.drawn).toBe(true)
    },
    { timeout },
  )

  // Wait for LinkedReadsDisplay (displays[1]) to have rendered data
  await waitFor(
    () => {
      const linkedReadsDisplay = view.tracks[0].displays[1]
      console.log('LinkedReadsDisplay exists:', !!linkedReadsDisplay)
      console.log('LinkedReadsDisplay has imageData:', !!linkedReadsDisplay?.renderingImageData)
      console.log('LinkedReadsDisplay layoutHeight:', linkedReadsDisplay?.layoutHeight)
      expect(linkedReadsDisplay).toBeDefined()
      expect(linkedReadsDisplay.renderingImageData).toBeDefined()
    },
    { timeout },
  )
}

async function testStack(loc: string, track: string) {
  const user = userEvent.setup()
  const { view, findByTestId, findAllByText, findByText } = await createView()
  const opts = [{}, { timeout }] as const
  await view.navToLocString(loc)
  await user.click(await findByTestId(hts(track), ...opts))
  await user.click(await findByTestId('track_menu_icon', ...opts))
  await user.click(await findByText('Replace lower panel with...'))
  await user.click((await findAllByText('Linked reads display'))[0]!)
  await wait(view)
  console.log('About to take snapshot of stack-canvas')
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
