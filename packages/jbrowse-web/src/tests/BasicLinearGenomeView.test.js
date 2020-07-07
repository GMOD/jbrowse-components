// library
import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  wait,
  waitForElement,
} from '@testing-library/react'
import React from 'react'

// locals
import { clearCache } from '@gmod/jbrowse-core/util/io/rangeFetcher'
import { clearAdapterCache } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import { setup, readBuffer, getPluginManager } from './util'
import JBrowse from '../JBrowse'

setup()
afterEach(cleanup)

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(readBuffer)
})
describe('valid file tests', () => {
  beforeEach(() => {
    fetch.resetMocks()
    fetch.mockResponse(readBuffer)
  })
  it('access about menu', async () => {
    const pluginManager = getPluginManager()
    const { findByText } = render(<JBrowse pluginManager={pluginManager} />)

    fireEvent.click(await findByText('Help'))
    fireEvent.click(await findByText('About'))

    const dlg = await findByText(/The Evolutionary Software Foundation/)
    expect(dlg).toBeTruthy()
  })

  it('click and drag to move sideways', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId } = render(<JBrowse pluginManager={pluginManager} />)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))

    const start = state.session.views[0].offsetPx
    const track = await findByTestId('track-volvox_alignments')
    fireEvent.mouseDown(track, { clientX: 250, clientY: 20 })
    fireEvent.mouseMove(track, { clientX: 100, clientY: 20 })
    fireEvent.mouseUp(track, { clientX: 100, clientY: 20 })
    // wait for requestAnimationFrame
    await wait(() => {})
    const end = state.session.views[0].offsetPx
    expect(end - start).toEqual(150)
  })

  it('click and drag to rubberBand', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    const track = await findByTestId('rubberBand_controls')

    expect(state.session.views[0].bpPerPx).toEqual(0.05)
    fireEvent.mouseDown(track, { clientX: 100, clientY: 0 })
    fireEvent.mouseMove(track, { clientX: 250, clientY: 0 })
    fireEvent.mouseUp(track, { clientX: 250, clientY: 0 })
    const zoomMenuItem = await findByText('Zoom to region')
    fireEvent.click(zoomMenuItem)
    expect(state.session.views[0].bpPerPx).toEqual(0.02)
  })

  it('click and drag to reorder tracks', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId } = render(<JBrowse pluginManager={pluginManager} />)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))

    const trackId1 = state.session.views[0].tracks[1].id
    const dragHandle0 = await findByTestId(
      'dragHandle-integration_test-volvox_alignments',
    )
    const trackRenderingContainer1 = await findByTestId(
      'trackRenderingContainer-integration_test-volvox_filtered_vcf',
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
    await wait(() => expect(state.session.views[0].tracks[0].id).toBe(trackId1))
  })

  it('click and zoom in and back out', async () => {
    jest.useFakeTimers()
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('ctgA')
    const before = state.session.views[0].bpPerPx
    fireEvent.click(await findByTestId('zoom_in'))
    await wait(() => {
      jest.runAllTimers()
      expect(state.session.views[0].bpPerPx).toBe(before / 2)
    })
    expect(state.session.views[0].bpPerPx).toBe(before / 2)
    fireEvent.click(await findByTestId('zoom_out'))
    await wait(() => {
      jest.runAllTimers()
      expect(state.session.views[0].bpPerPx).toBe(before)
    })
    expect(state.session.views[0].bpPerPx).toBe(before)
  }, 10000)

  it('opens track selector', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId } = render(<JBrowse pluginManager={pluginManager} />)

    await findByTestId('htsTrackEntry-volvox_alignments')
    expect(state.session.views[0].tracks.length).toBe(0)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
    expect(state.session.views[0].tracks.length).toBe(1)
  })

  it('opens reference sequence track and expects zoom in message', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { getAllByText, findByTestId } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_refseq'))
    state.session.views[0].setNewView(20, 0)
    await findByTestId('track-volvox_refseq')
    expect(getAllByText('Zoom in to see sequence')).toBeTruthy()
  })

  it('click to display center line with correct value', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, getByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )

    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
    await findByTestId('track-volvox_alignments')

    // opens the view menu and selects show center line
    const viewMenu = await findByTestId('view_menu_icon')
    fireEvent.click(viewMenu)
    await waitForElement(() => getByText('Show center line'))
    fireEvent.click(getByText('Show center line'))
    expect(state.session.views[0].showCenterLine).toBe(true)

    const { centerLineInfo } = state.session.views[0]
    expect(centerLineInfo.refName).toBe('ctgA')
    expect(centerLineInfo.offset).toEqual(120)
  })
})
