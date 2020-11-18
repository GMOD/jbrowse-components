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
import { LocalFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/rangeFetcher'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { setup, generateReadBuffer, getPluginManager } from './util'
import JBrowse from '../JBrowse'

setup()
afterEach(cleanup)

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(
    generateReadBuffer(url => {
      return new LocalFile(require.resolve(`../../test_data/volvox/${url}`))
    }),
  )
})
describe('valid file tests', () => {
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
    const track = await findByTestId('display-volvox_alignments_alignments')
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
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findAllByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findAllByText('ctgA')
    const before = state.session.views[0].bpPerPx
    fireEvent.click(await findByTestId('zoom_in'))
    await wait(() => {
      const after = state.session.views[0].bpPerPx
      expect(after).toBe(before / 2)
    })
    expect(state.session.views[0].bpPerPx).toBe(before / 2)
    fireEvent.click(await findByTestId('zoom_out'))
    await wait(() => {
      const after = state.session.views[0].bpPerPx
      expect(after).toBe(before)
    })
    expect(state.session.views[0].bpPerPx).toBe(before)
  }, 30000)

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
    await findByTestId('display-volvox_refseq-LinearReferenceSequenceDisplay')
    expect(getAllByText('Zoom in to see sequence')).toBeTruthy()
  })

  it('click to display center line with correct value', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, getByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )

    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
    await findByTestId('display-volvox_alignments_alignments')

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

  it('test navigation with the search input box', async () => {
    const pluginManager = getPluginManager()
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    fireEvent.click(await findByText('Help'))

    // need this to complete before we can try to search
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
    await findByTestId(
      'trackRenderingContainer-integration_test-volvox_alignments',
    )

    const target = await findByTestId('search-input')
    const form = await findByTestId('search-form')
    fireEvent.change(target, { target: { value: 'contigA:1-200' } })
    form.submit()
    // can't just hit enter it seems
    // fireEvent.keyDown(target, { key: 'Enter', code: 'Enter' })
    await wait(() => {
      expect(target.value).toBe('ctgA:1..200')
    })
    expect(target.value).toBe('ctgA:1..200')
  })
})
