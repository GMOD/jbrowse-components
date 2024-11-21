import { createEvent, fireEvent, waitFor, screen } from '@testing-library/react'
import { setup, createView, doBeforeEach, hts } from './util'
setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 10000 }
const opts = [{}, delay]

test('access about menu', async () => {
  const { findByText, findAllByText } = await createView()

  fireEvent.click(await findByText('Help', ...opts))
  fireEvent.click(await findByText('About', ...opts))

  await findByText(/The Evolutionary Software Foundation/, ...opts)

  // wait for ctgA because otherwise can give 'import a file after jest
  // environment has been torn down'
  await findAllByText('ctgA', ...opts)
}, 30000)

test('click and drag to move sideways', async () => {
  const { view, findByTestId, findAllByText } = await createView()
  await findAllByText('ctgA', ...opts)
  const start = view.offsetPx
  const track = await findByTestId('trackContainer', ...opts)
  fireEvent.mouseDown(track, { clientX: 250, clientY: 20 })
  fireEvent.mouseMove(track, { clientX: 100, clientY: 20 })
  fireEvent.mouseUp(track, { clientX: 100, clientY: 20 })
  await waitFor(() => {
    expect(view.offsetPx - start).toEqual(150)
  }, delay)
}, 30000)

test('click and drag to rubberband', async () => {
  const { view, findByTestId, findByText } = await createView()
  const track = await findByTestId('rubberband_controls', ...opts)
  expect(view.bpPerPx).toEqual(0.05)
  fireEvent.mouseDown(track, { clientX: 100, clientY: 0 })
  fireEvent.mouseMove(track, { clientX: 250, clientY: 0 })
  fireEvent.mouseUp(track, { clientX: 250, clientY: 0 })
  fireEvent.click(await findByText('Zoom to region'))
  expect(view.bpPerPx).toEqual(0.02)
}, 30000)

test('click and drag rubberband, click get sequence to open sequenceDialog', async () => {
  const { view, findByTestId, findByText } = await createView()
  const rubberband = await findByTestId('rubberband_controls', ...opts)
  expect(view.bpPerPx).toEqual(0.05)
  fireEvent.mouseDown(rubberband, { clientX: 100, clientY: 0 })
  fireEvent.mouseMove(rubberband, { clientX: 250, clientY: 0 })
  fireEvent.mouseUp(rubberband, { clientX: 250, clientY: 0 })
  fireEvent.click(await findByText('Get sequence'))
  expect(view.leftOffset).toBeTruthy()
  expect(view.rightOffset).toBeTruthy()
}, 30000)

test('click and drag to reorder tracks', async () => {
  const { view, findByTestId } = await createView()
  fireEvent.click(await findByTestId(hts('bigbed_genes'), ...opts))
  fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), ...opts))

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
  fireEvent.dragEnter(container1)
  fireEvent.dragEnd(dragHandle0, { clientX: 10, clientY: 220 })
  fireEvent.mouseUp(dragHandle0, { clientX: 10, clientY: 220 })
  await waitFor(() => {
    expect(view.tracks[0].id).toBe(trackId1)
  })
}, 30000)

test('click and zoom in and back out', async () => {
  const { view, findByTestId, findAllByText } = await createView()
  await findAllByText('ctgA', ...opts)
  const before = view.bpPerPx
  fireEvent.click(await findByTestId('zoom_in'))
  await waitFor(() => {
    expect(view.bpPerPx).toBe(before / 2)
  }, delay)

  // wait for it not to be disabled also
  const elt = await findByTestId('zoom_out')
  await waitFor(() => {
    expect(elt).toHaveProperty('disabled', false)
  })
  fireEvent.click(elt)

  await waitFor(() => {
    expect(view.bpPerPx).toBe(before)
  }, delay)
}, 60000)

test('opens track selector', async () => {
  const { view, findByTestId, findAllByText } = await createView()
  await findAllByText('ctgA', ...opts)
  await findByTestId(hts('bigbed_genes'), ...opts)
  expect(view.tracks.length).toBe(0)
  fireEvent.click(await findByTestId(hts('bigbed_genes'), ...opts))
  expect(view.tracks.length).toBe(1)
}, 30000)

test('opens reference sequence track and expects zoom in message', async () => {
  const { view, findByTestId, findAllByText } = await createView()
  fireEvent.click(await findByTestId(hts('volvox_refseq'), ...opts))
  view.setNewView(20, 0)
  await findByTestId(
    'display-volvox_refseq-LinearReferenceSequenceDisplay',
    {},
    delay,
  )
  await findAllByText('Zoom in to see sequence')
}, 30000)

test('click to display center line with correct value', async () => {
  const { view, findByTestId, findByText } = await createView()
  fireEvent.click(await findByTestId(hts('bigbed_genes'), ...opts))

  // opens the view menu and selects show center line
  fireEvent.click(await findByTestId('view_menu_icon', ...opts))
  fireEvent.click(await findByText('Show center line', ...opts))
  expect(view.showCenterLine).toBe(true)
  expect(view.centerLineInfo?.refName).toBe('ctgA')
  expect(view.centerLineInfo?.offset).toEqual(120)
}, 30000)

test('test choose option from dropdown refName autocomplete', async () => {
  const {
    findByTestId,
    findAllByText,
    findByPlaceholderText,
    getByPlaceholderText,
  } = await createView()

  await findAllByText('ctgA', ...opts)
  fireEvent.click(await findByPlaceholderText('Search for location'))
  const autocomplete = await findByTestId('autocomplete')
  autocomplete.focus()
  fireEvent.keyDown(autocomplete, { key: 'ArrowDown' })
  fireEvent.keyDown(autocomplete, { key: 'ArrowDown' })
  fireEvent.click((await screen.findAllByText('ctgB'))[0]!)
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })

  await waitFor(() => {
    const n = getByPlaceholderText('Search for location') as HTMLInputElement
    expect(n.value).toEqual(expect.stringContaining('ctgB'))
  }, delay)
}, 30000)
