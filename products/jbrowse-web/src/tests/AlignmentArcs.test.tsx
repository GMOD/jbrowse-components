import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// locals
import { setup, expectCanvasMatch, doBeforeEach, createView, hts } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

async function wait(view: any) {
  await waitFor(() => {
    expect(view.tracks[0].displays[0].PileupDisplay.drawn).toBe(true)
  }, delay)
}

const delay = { timeout: 60000 }
const opts = [{}, delay]

test('toggle short-read arc display', async () => {
  const user = userEvent.setup()
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  await view.navToLocString('ctgA:1-50000')
  await user.click(await findByTestId(hts('volvox_sv_cram'), ...opts))
  await user.click(await findByTestId('track_menu_icon', ...opts))
  await user.click(await findByText('Replace lower panel with...'))
  await user.click((await findAllByText('Arc display'))[0]!)
  await wait(view)
  expectCanvasMatch(getByTestId('arc-canvas'))
}, 60000)

test('toggle short-read cloud display', async () => {
  const user = userEvent.setup()
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  await view.navToLocString('ctgA:1-50000')
  await user.click(await findByTestId(hts('volvox_sv_cram'), ...opts))
  await user.click(await findByTestId('track_menu_icon', ...opts))
  await user.click(await findByText('Replace lower panel with...'))
  await user.click((await findAllByText('Read cloud display'))[0]!)
  await wait(view)
  expectCanvasMatch(getByTestId('cloud-canvas'))
}, 60000)

test('toggle long-read cloud display', async () => {
  const user = userEvent.setup()
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  await view.navToLocString('ctgA:19,101..32,027')
  await user.click(await findByTestId(hts('volvox-simple-inv.bam'), ...opts))
  await user.click(await findByTestId('track_menu_icon', ...opts))
  await user.click(await findByText('Replace lower panel with...'))
  await user.click((await findAllByText('Read cloud display'))[0]!)
  await wait(view)
  expectCanvasMatch(getByTestId('cloud-canvas'))
}, 60000)

test('toggle long-read arc display', async () => {
  const user = userEvent.setup()
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  await view.navToLocString('ctgA:19,101..32,027')
  await user.click(await findByTestId(hts('volvox-simple-inv.bam'), ...opts))
  await user.click(await findByTestId('track_menu_icon', ...opts))
  await user.click(await findByText('Replace lower panel with...'))
  await user.click((await findAllByText('Arc display'))[0]!)
  await wait(view)
  expectCanvasMatch(getByTestId('arc-canvas'))
}, 60000)

test('toggle long-read arc display, use out of view pairing', async () => {
  const user = userEvent.setup()
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  await view.navToLocString('ctgA:478..6,191')
  await user.click(
    await findByTestId(hts('volvox-long-reads-sv-cram'), ...opts),
  )
  await user.click(await findByTestId('track_menu_icon', ...opts))
  await user.click(await findByText('Replace lower panel with...'))
  await user.click((await findAllByText('Arc display'))[0]!)
  await wait(view)
  expectCanvasMatch(getByTestId('arc-canvas'))
}, 60000)

test('toggle short-read arc display, use out of view pairing', async () => {
  const user = userEvent.setup()
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  await view.navToLocString('ctgA:478..6,191')
  await user.click(await findByTestId(hts('volvox_sv_cram'), ...opts))
  await user.click(await findByTestId('track_menu_icon', ...opts))
  await user.click(await findByText('Replace lower panel with...'))
  await user.click((await findAllByText('Arc display'))[0]!)
  await wait(view)
  expectCanvasMatch(getByTestId('arc-canvas'))
}, 60000)
