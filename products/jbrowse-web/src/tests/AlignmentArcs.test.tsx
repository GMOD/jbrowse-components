import { fireEvent, waitFor } from '@testing-library/react'

// locals
import { setup, expectCanvasMatch, doBeforeEach, createView, hts } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function wait(view: any) {
  await waitFor(
    () => expect(view.tracks[0].displays[0].PileupDisplay.drawn).toBe(true),
    delay,
  )
}

const delay = { timeout: 50000 }
const opts = [{}, delay]

test('toggle short-read arc display', async () => {
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  await view.navToLocString('ctgA:1-50000')
  fireEvent.click(await findByTestId(hts('volvox_sv_cram'), ...opts))
  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Replace lower panel with...'))
  fireEvent.click((await findAllByText('Arc display'))[0])
  await wait(view)
  expectCanvasMatch(getByTestId('arc-canvas'))
}, 50000)

test('toggle short-read cloud display', async () => {
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  await view.navToLocString('ctgA:1-50000')
  fireEvent.click(await findByTestId(hts('volvox_sv_cram'), ...opts))
  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Replace lower panel with...'))
  fireEvent.click((await findAllByText('Read cloud display'))[0])
  await wait(view)
  expectCanvasMatch(getByTestId('cloud-canvas'))
}, 50000)

test('toggle long-read cloud display', async () => {
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  await view.navToLocString('ctgA:19,101..32,027')
  fireEvent.click(await findByTestId(hts('volvox-simple-inv.bam'), ...opts))
  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Replace lower panel with...'))
  fireEvent.click((await findAllByText('Read cloud display'))[0])
  await wait(view)
  expectCanvasMatch(getByTestId('cloud-canvas'))
}, 50000)

test('toggle long-read arc display', async () => {
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  await view.navToLocString('ctgA:19,101..32,027')
  fireEvent.click(await findByTestId(hts('volvox-simple-inv.bam'), ...opts))
  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Replace lower panel with...'))
  fireEvent.click((await findAllByText('Arc display'))[0])
  await wait(view)
  expectCanvasMatch(getByTestId('arc-canvas'))
}, 50000)

test('toggle long-read arc display, use out of view pairing', async () => {
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  await view.navToLocString('ctgA:478..6,191')
  fireEvent.click(await findByTestId(hts('volvox-long-reads-sv-cram'), ...opts))
  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Replace lower panel with...'))
  fireEvent.click((await findAllByText('Arc display'))[0])
  await wait(view)
  expectCanvasMatch(getByTestId('arc-canvas'))
}, 50000)

test('toggle short-read arc display, use out of view pairing', async () => {
  const { view, getByTestId, findByTestId, findAllByText, findByText } =
    await createView()
  await view.navToLocString('ctgA:478..6,191')
  fireEvent.click(await findByTestId(hts('volvox_sv_cram'), ...opts))
  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Replace lower panel with...'))
  fireEvent.click((await findAllByText('Arc display'))[0])
  await wait(view)
  expectCanvasMatch(getByTestId('arc-canvas'))
}, 50000)
