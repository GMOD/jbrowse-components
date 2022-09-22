import { createEvent, fireEvent, waitFor, screen } from '@testing-library/react'
import { setup, createView, doBeforeEach, hts } from './util'
setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }
const total = 30000

test(
  'access about menu',
  async () => {
    const { findByText } = createView()

    fireEvent.click(await findByText('Help'))
    fireEvent.click(await findByText('About'))

    await findByText(/The Evolutionary Software Foundation/, {}, delay)
  },
  total,
)

test(
  'click and drag to move sideways',
  async () => {
    const { view, findByTestId } = createView()
    const start = view.offsetPx
    const track = await findByTestId('trackContainer', {}, delay)
    fireEvent.mouseDown(track, { clientX: 250, clientY: 20 })
    fireEvent.mouseMove(track, { clientX: 100, clientY: 20 })
    fireEvent.mouseUp(track, { clientX: 100, clientY: 20 })
    await waitFor(() => expect(view.offsetPx - start).toEqual(150), delay)
  },
  total,
)

test(
  'click and drag to rubberband',
  async () => {
    const { view, findByTestId, findByText } = createView()
    const track = await findByTestId('rubberBand_controls', {}, delay)
    expect(view.bpPerPx).toEqual(0.05)
    fireEvent.mouseDown(track, { clientX: 100, clientY: 0 })
    fireEvent.mouseMove(track, { clientX: 250, clientY: 0 })
    fireEvent.mouseUp(track, { clientX: 250, clientY: 0 })
    fireEvent.click(await findByText('Zoom to region'))
    expect(view.bpPerPx).toEqual(0.02)
  },
  total,
)

test(
  'click and drag rubberBand, click get sequence to open sequenceDialog',
  async () => {
    const { view, findByTestId, findByText } = createView()
    const rubberband = await findByTestId('rubberBand_controls', {}, delay)
    expect(view.bpPerPx).toEqual(0.05)
    fireEvent.mouseDown(rubberband, { clientX: 100, clientY: 0 })
    fireEvent.mouseMove(rubberband, { clientX: 250, clientY: 0 })
    fireEvent.mouseUp(rubberband, { clientX: 250, clientY: 0 })
    fireEvent.click(await findByText('Get sequence'))
    expect(view.leftOffset).toBeTruthy()
    expect(view.rightOffset).toBeTruthy()
  },
  total,
)

test(
  'click and drag to reorder tracks',
  async () => {
    const { view, findByTestId } = createView()
    fireEvent.click(await findByTestId(hts('bigbed_genes'), {}, delay))
    fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), {}, delay))

    const trackId1 = view.tracks[1].id
    const dragHandle0 = await findByTestId(
      'dragHandle-integration_test-bigbed_genes',
      {},
      delay,
    )
    const trackRenderingContainer1 = await findByTestId(
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
    fireEvent.dragEnter(trackRenderingContainer1)
    fireEvent.dragEnd(dragHandle0, { clientX: 10, clientY: 220 })
    fireEvent.mouseUp(dragHandle0, { clientX: 10, clientY: 220 })
    await waitFor(() => expect(view.tracks[0].id).toBe(trackId1))
  },
  total,
)

test(
  'click and zoom in and back out',
  async () => {
    const { view, findByTestId, findAllByText } = createView()
    await findAllByText('ctgA', {}, delay)
    const before = view.bpPerPx
    fireEvent.click(await findByTestId('zoom_in'))
    await waitFor(() => expect(view.bpPerPx).toBe(before / 2), delay)
    fireEvent.click(await findByTestId('zoom_out'))
    await waitFor(() => expect(view.bpPerPx).toBe(before), delay)
  },
  total,
)

test(
  'opens track selector',
  async () => {
    const { view, findByTestId } = createView()
    await findByTestId(hts('bigbed_genes'), {}, delay)
    expect(view.tracks.length).toBe(0)
    fireEvent.click(await findByTestId(hts('bigbed_genes'), {}, delay))
    expect(view.tracks.length).toBe(1)
  },
  total,
)

test(
  'opens reference sequence track and expects zoom in message',
  async () => {
    const { view, findByTestId, findAllByText } = createView()
    fireEvent.click(await findByTestId(hts('volvox_refseq'), {}, delay))
    view.setNewView(20, 0)
    await findByTestId(
      'display-volvox_refseq-LinearReferenceSequenceDisplay',
      {},
      delay,
    )
    await findAllByText('Zoom in to see sequence')
  },
  total,
)

test(
  'click to display center line with correct value',
  async () => {
    const { view, findByTestId, findByText } = createView()
    fireEvent.click(await findByTestId(hts('bigbed_genes'), {}, delay))

    // opens the view menu and selects show center line
    fireEvent.click(await findByTestId('view_menu_icon'))
    fireEvent.click(await findByText('Show center line'))
    expect(view.showCenterLine).toBe(true)
    expect(view.centerLineInfo?.refName).toBe('ctgA')
    expect(view.centerLineInfo?.offset).toEqual(120)
  },
  total,
)

test(
  'test choose option from dropdown refName autocomplete',
  async () => {
    const {
      view,
      findByText,
      findByTestId,
      getByPlaceholderText,
      findByPlaceholderText,
    } = createView()

    expect(view.displayedRegions[0].refName).toEqual('ctgA')
    fireEvent.click(await findByText('Help'))
    // need this to complete before we can try to search
    fireEvent.click(await findByTestId(hts('bigbed_genes'), {}, delay))
    await findByTestId(
      'trackRenderingContainer-integration_test-bigbed_genes',
      {},
      delay,
    )

    const autocomplete = await findByTestId('autocomplete')
    const inputBox = await findByPlaceholderText('Search for location')
    await waitFor(() =>
      expect(view.coarseDynamicBlocks.length).toBeGreaterThan(0),
    )
    fireEvent.mouseDown(inputBox)
    autocomplete.focus()
    fireEvent.keyDown(autocomplete, { key: 'ArrowDown' })
    fireEvent.keyDown(autocomplete, { key: 'ArrowDown' })
    fireEvent.click((await screen.findAllByText('ctgB'))[0])
    fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })

    await waitFor(
      () => expect(view.displayedRegions[0].refName).toEqual('ctgB'),
      delay,
    )

    await waitFor(() => {
      const n = getByPlaceholderText('Search for location') as HTMLInputElement
      expect(n.value).toEqual(expect.stringContaining('ctgB'))
    }, delay)
  },
  total,
)
