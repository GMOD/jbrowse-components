import {
  createEvent,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import {
  createView,
  doBeforeEach,
  findDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

// The two tracks this file opens out of the track list. `volvox_refseq` is the
// assembly's own sequence track and survives any trim. Two tests below
// deliberately keep the whole config, and say why - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['bigbed_genes', 'volvox_filtered_vcf'])

const delay = { timeout: 10000 }
const opts = [{}, delay]

test('access about menu', async () => {
  const { findByText, findAllByText } = await createView(config)

  fireEvent.click(await findByText('Help', ...opts))
  fireEvent.click(await findByText('About', ...opts))

  await findByText(/The Evolutionary Software Foundation/, ...opts)

  // wait for ctgA because otherwise can give 'import a file after jest
  // environment has been torn down'
  await findAllByText('ctgA', ...opts)
}, 30000)

test('click and drag to move sideways', async () => {
  const { view, findByTestId, findAllByText } = await createView(config)
  await findAllByText('ctgA', ...opts)
  const start = view.offsetPx
  const track = await findByTestId('tracksContainer', ...opts)
  fireEvent.mouseDown(track, { clientX: 250, clientY: 20 })
  fireEvent.mouseMove(track, { clientX: 100, clientY: 20 })
  fireEvent.mouseUp(track, { clientX: 100, clientY: 20 })
  await waitFor(() => {
    expect(view.offsetPx - start).toEqual(150)
  }, delay)
}, 30000)

test('click and drag to rubberband', async () => {
  const { view, findByTestId, findByText } = await createView(config)
  const track = await findByTestId('rubberband_controls', ...opts)
  // `bpPerPx` is derived from the stored window (windowWidthBp / width), so it
  // carries a ULP of division residue and is not the literal the zoom was asked
  // for. Every consumer that compares it — the fetch caches' isCacheValid, the
  // coarse-block gate — compares it against a value read from this same getter,
  // so they see one stable double; only a test comparing against a hand-written
  // literal can see the residue.
  expect(view.bpPerPx).toBeCloseTo(0.05)
  fireEvent.mouseDown(track, { clientX: 100, clientY: 0 })
  fireEvent.mouseMove(track, { clientX: 250, clientY: 0 })
  fireEvent.mouseUp(track, { clientX: 250, clientY: 0 })
  fireEvent.click(await findByText('Zoom to region'))
  expect(view.bpPerPx).toBeCloseTo(0.02)
}, 30000)

test('click and drag rubberband, click get sequence to open sequenceDialog', async () => {
  const { view, findByTestId, findByText } = await createView(config)
  const rubberband = await findByTestId('rubberband_controls', ...opts)
  expect(view.bpPerPx).toBeCloseTo(0.05)
  fireEvent.mouseDown(rubberband, { clientX: 100, clientY: 0 })
  fireEvent.mouseMove(rubberband, { clientX: 250, clientY: 0 })
  fireEvent.mouseUp(rubberband, { clientX: 250, clientY: 0 })
  fireEvent.click(await findByText('Get sequence'))
  expect(view.leftOffset).toBeTruthy()
  expect(view.rightOffset).toBeTruthy()
}, 30000)

// On the whole config, along with the selector test below: both are about the
// track list itself rather than about a track.
test('click and drag to reorder tracks', async () => {
  const { view, findByTestId } = await createView()
  fireEvent.click(await findByTestId(hts('bigbed_genes'), ...opts))
  fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), ...opts))
  await waitFor(() => {
    expect(view.tracks.length).toBe(2)
  })

  const trackId1 = view.tracks[1].id
  const dragHandle0 = await findByTestId(
    'dragHandle-integration_test-bigbed_genes',
    {},
    delay,
  )
  const container1 = await findByTestId(
    'trackRenderingContainer-integration_test-volvox_filtered_vcf',
    {},
    delay,
  )
  const dragStartEvent = createEvent.dragStart(dragHandle0)
  // Have to mock 'dataTransfer' because it's not supported in jsdom
  Object.defineProperty(dragStartEvent, 'dataTransfer', {
    value: { setDragImage: () => {} },
  })
  fireEvent.mouseDown(dragHandle0, { clientX: 10, clientY: 100 })
  fireEvent(dragHandle0, dragStartEvent)
  fireEvent.mouseMove(dragHandle0, { clientX: 10, clientY: 220 })
  fireEvent.dragOver(container1, { clientY: 220 })
  fireEvent.dragEnd(dragHandle0, { clientX: 10, clientY: 220 })
  fireEvent.mouseUp(dragHandle0, { clientX: 10, clientY: 220 })
  await waitFor(() => {
    expect(view.tracks[0].id).toBe(trackId1)
  })
}, 30000)

test('click and zoom in and back out', async () => {
  const { view, findByTestId, findAllByText } = await createView(config)
  await findAllByText('ctgA', ...opts)

  // mock requestAnimationFrame and performance.now so the spring
  // animation used by zoom() completes synchronously
  const origRAF = window.requestAnimationFrame
  const origPerfNow = performance.now.bind(performance)
  let fakeTime = origPerfNow()
  performance.now = () => fakeTime
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    fakeTime += 16
    cb(fakeTime)
    return 0
  }

  // wait for coarseBpPerPx to be set (500ms debounced autorun) so
  // the zoom buttons become enabled
  const before = view.bpPerPx
  await waitFor(() => {
    expect(view.coarseBpPerPx).toBeGreaterThan(0)
  }, delay)

  fireEvent.click(await findByTestId('zoom_in'))
  await waitFor(() => {
    expect(view.bpPerPx).toBe(before / 2)
  }, delay)

  fireEvent.click(await findByTestId('zoom_out'))
  await waitFor(() => {
    expect(view.bpPerPx).toBe(before)
  }, delay)

  window.requestAnimationFrame = origRAF
  performance.now = origPerfNow
}, 60000)

test('opens track selector', async () => {
  const { view, findByTestId, findAllByText } = await createView()
  await findAllByText('ctgA', ...opts)
  await findByTestId(hts('bigbed_genes'), ...opts)
  expect(view.tracks.length).toBe(0)
  fireEvent.click(await findByTestId(hts('bigbed_genes'), ...opts))
  // the show goes through the async launchTrack path now
  await waitFor(() => {
    expect(view.tracks.length).toBe(1)
  })
}, 30000)

test('opens reference sequence track and expects zoom in message', async () => {
  const { view, findByTestId, findAllByText } = await createView(config)
  fireEvent.click(await findByTestId(hts('volvox_refseq'), ...opts))
  view.setNewView(20, 0)
  // `findDisplayPainted`, not a bare `findByTestId`: zoomed past base resolution
  // the display renders the message instead of a `<canvas>`, so `canvasDrawn`
  // can never flip — and it says so through `rendersCanvas: false`, which is
  // what makes `painted` (and so `data-display-drawn`) report finished rather
  // than pending forever. Waiting on mere presence here was the assertion that
  // the old, wrong answer was in place; `PENDING_DISPLAYS` keys on the same
  // signal, so every `waitForDisplaysDone` on a page showing this track used to
  // time out.
  await findDisplayPainted('sequence-display', delay)
  await findAllByText('Zoom in to see sequence')
}, 30000)

test('click to display center line with correct value', async () => {
  const { view, findByTestId, findByText } = await createView(config)
  fireEvent.click(await findByTestId(hts('bigbed_genes'), ...opts))

  // opens the view menu and selects show center line
  fireEvent.click(await findByTestId('view_menu_icon', ...opts))
  fireEvent.click(await findByText('Show...', ...opts))
  fireEvent.click(await findByText('Show center line', ...opts))
  expect(view.showCenterLine).toBe(true)
  expect(view.centerLineInfo?.refName).toBe('ctgA')
  expect(view.centerLineInfo?.offset).toEqual(120.2)
}, 30000)

test('test choose option from dropdown refName autocomplete', async () => {
  const { findAllByText, findByPlaceholderText, getByPlaceholderText } =
    await createView(config)

  await findAllByText('ctgA', ...opts)
  const input = await findByPlaceholderText('Search for location')
  // userEvent, not fireEvent: the MUI Autocomplete opens its listbox off the
  // focus/pointer sequence, so a bare click event leaves it closed and the
  // findByRole('listbox') below times out.
  const user = userEvent.setup()
  await user.click(input)
  await user.click(
    within(await screen.findByRole('listbox', ...opts)).getByText(/ctgB/),
  )

  await waitFor(() => {
    const n = getByPlaceholderText('Search for location') as HTMLInputElement
    expect(n.value).toEqual(expect.stringContaining('ctgB'))
  }, delay)
}, 30000)
