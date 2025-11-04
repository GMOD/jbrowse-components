import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, doBeforeEach, expectCanvasMatch, hts, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

async function wait(view: any) {
  await waitFor(
    () => {
      expect(view.tracks[0].displays[0].PileupDisplay.drawn).toBe(true)
    },
    { timeout: 60000 },
  )
}

async function testStack(loc: string, track: string) {
  const user = userEvent.setup()
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  const opts = [{}, { timeout: 60000 }] as const
  await view.navToLocString(loc)
  await user.click(await findByTestId(hts(track), ...opts))
  await user.click(await findByTestId('track_menu_icon', ...opts))
  await user.click(await findByText('Replace lower panel with...'))
  await user.click((await findAllByText('Linked reads display'))[0]!)
  await wait(view)
  await new Promise(res => setTimeout(res, 2000))
  expectCanvasMatch(getByTestId('stack-canvas'))
}

test('short-read stack display', async () => {
  await testStack('ctgA:1-50000', 'volvox_sv_cram')
}, 60000)

test('long-read stack display', async () => {
  await testStack('ctgA:19,101..32,027', 'volvox-simple-inv.bam')
}, 60000)

test('long-read stack display, out of view pairing', async () => {
  await testStack('ctgA:478..6,191', 'volvox-long-reads-sv-cram')
}, 60000)

test('short-read stack display, out of view pairing', async () => {
  await testStack('ctgA:478..6,191', 'volvox_sv_cram')
}, 60000)

test('short-read stack display at ctgA:33,623..35,216', async () => {
  await testStack('ctgA:33,623..35,216', 'volvox_sv_cram')
}, 60000)
