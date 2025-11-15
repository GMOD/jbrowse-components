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
  console.log('=== Starting wait function ===')

  // Wait for PileupDisplay to be drawn
  console.log('Waiting for PileupDisplay to be drawn...')
  await waitFor(
    () => {
      const drawn = view.tracks[0].displays[0].PileupDisplay.drawn
      console.log('PileupDisplay.drawn:', drawn)
      expect(drawn).toBe(true)
    },
    { timeout },
  )
  console.log('PileupDisplay is drawn')

  // Wait for the stack-canvas element to appear and be rendered
  console.log('Waiting for stack-canvas element...')
  await findByTestId('stack-canvas', {}, { timeout })
  console.log('stack-canvas element found')

  // Wait a bit for the canvas to be fully populated
  console.log('Waiting for canvas to have content...')
  await waitFor(
    () => {
      const canvas = document.querySelector(
        '[data-testid="stack-canvas"]',
      ) as HTMLCanvasElement
      console.log('Canvas:', !!canvas)
      console.log('Canvas dimensions:', canvas?.width, 'x', canvas?.height)
      expect(canvas).toBeDefined()

      // Check that the canvas has been drawn to (not blank)
      const ctx = canvas?.getContext('2d')
      if (!ctx) {
        console.log('No canvas context')
        throw new Error('No canvas context')
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const hasContent = imageData.data.some(pixel => pixel !== 0)
      console.log('Canvas has content:', hasContent)
      console.log('First 100 pixels:', Array.from(imageData.data.slice(0, 100)))
      expect(hasContent).toBe(true)
    },
    { timeout },
  )
  console.log('=== Wait function complete ===')
}

async function testStack(loc: string, track: string) {
  console.log(`\n=== Starting test for ${track} at ${loc} ===`)
  const user = userEvent.setup()
  const { view, findByTestId, findAllByText, findByText, queryAllByText } =
    await createView()
  const opts = [{}, { timeout }] as const

  console.log('Navigating to location...')
  await view.navToLocString(loc)

  console.log('Clicking track...')
  await user.click(await findByTestId(hts(track), ...opts))

  console.log('Opening track menu...')
  await user.click(await findByTestId('track_menu_icon', ...opts))

  console.log('Clicking "Replace lower panel with..."')
  await user.click(await findByText('Replace lower panel with...'))

  // Add a small delay to let the submenu render
  await new Promise(resolve => setTimeout(resolve, 100))

  console.log('Looking for "Linked reads display" option...')

  // Debug: check what's available
  const allText = document.body.textContent
  console.log('Available menu text includes "Linked reads display":', allText?.includes('Linked reads display'))
  console.log('Number of displays currently:', view.tracks[0]?.displays?.length)
  console.log('Display types:', view.tracks[0]?.displays?.map((d: any) => d.type))

  const linkedReadsOptions = queryAllByText('Linked reads display')
  console.log('Number of "Linked reads display" options found:', linkedReadsOptions.length)

  if (linkedReadsOptions.length === 0) {
    console.log('WARNING: No "Linked reads display" option found!')
    console.log('Available text on page:', allText?.substring(0, 500))
  }

  console.log('Selecting "Linked reads display"')
  await user.click((await findAllByText('Linked reads display'))[0]!)

  // Wait for the menu to close
  await new Promise(resolve => setTimeout(resolve, 100))

  console.log('Waiting for rendering...')
  await wait(view, findByTestId)

  console.log('Taking canvas snapshot...')
  expectCanvasMatch(await findByTestId('stack-canvas'))

  console.log(`=== Test complete for ${track} ===\n`)
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
