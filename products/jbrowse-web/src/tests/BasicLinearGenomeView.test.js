// library
import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  waitFor,
  screen,
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
    const track = await findByTestId(
      'display-volvox_alignments_alignments',
      {},
      { timeout: 10000 },
    )
    fireEvent.mouseDown(track, { clientX: 250, clientY: 20 })
    fireEvent.mouseMove(track, { clientX: 100, clientY: 20 })
    fireEvent.mouseUp(track, { clientX: 100, clientY: 20 })
    // wait for requestAnimationFrame
    await waitFor(() => {})
    const end = state.session.views[0].offsetPx
    expect(end - start).toEqual(150)
  }, 10000)

  it('click and drag to rubberBand', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    const track = await findByTestId(
      'rubberBand_controls',
      {},
      { timeout: 10000 },
    )

    expect(state.session.views[0].bpPerPx).toEqual(0.05)
    fireEvent.mouseDown(track, { clientX: 100, clientY: 0 })
    fireEvent.mouseMove(track, { clientX: 250, clientY: 0 })
    fireEvent.mouseUp(track, { clientX: 250, clientY: 0 })
    const zoomMenuItem = await findByText('Zoom to region')
    fireEvent.click(zoomMenuItem)
    expect(state.session.views[0].bpPerPx).toEqual(0.02)
  }, 15000)

  it('click and drag rubberBand, click get sequence to open sequenceDialog', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    const rubberBandComponent = await findByTestId(
      'rubberBand_controls',
      {},
      { timeout: 10000 },
    )

    expect(state.session.views[0].bpPerPx).toEqual(0.05)
    fireEvent.mouseDown(rubberBandComponent, { clientX: 100, clientY: 0 })
    fireEvent.mouseMove(rubberBandComponent, { clientX: 250, clientY: 0 })
    fireEvent.mouseUp(rubberBandComponent, { clientX: 250, clientY: 0 })
    const getSeqMenuItem = await findByText('Get sequence')
    fireEvent.click(getSeqMenuItem)
    expect(state.session.views[0].leftOffset).toBeTruthy()
    expect(state.session.views[0].rightOffset).toBeTruthy()
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
      {},
      { timeout: 10000 },
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
    await waitFor(() =>
      expect(state.session.views[0].tracks[0].id).toBe(trackId1),
    )
  })

  it('click and zoom in and back out', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findAllByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findAllByText('ctgA', {}, { timeout: 10000 })
    const before = state.session.views[0].bpPerPx
    fireEvent.click(await findByTestId('zoom_in'))
    await waitFor(
      () => {
        const after = state.session.views[0].bpPerPx
        expect(after).toBe(before / 2)
      },
      { timeout: 10000 },
    )
    expect(state.session.views[0].bpPerPx).toBe(before / 2)
    fireEvent.click(await findByTestId('zoom_out'))
    await waitFor(
      () => {
        const after = state.session.views[0].bpPerPx
        expect(after).toBe(before)
      },
      { timeout: 10000 },
    )
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

  it('test navigation with the search input box', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByText, findByTestId, findByPlaceholderText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    fireEvent.click(await findByText('Help'))
    // need this to complete before we can try to search
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))

    const autocomplete = await findByTestId('autocomplete')
    const inputBox = await findByPlaceholderText('Search for location')

    autocomplete.focus()
    inputBox.focus()
    fireEvent.mouseDown(inputBox)
    fireEvent.change(inputBox, {
      target: { value: '{volvox2}ctgB:1..200' },
    })
    fireEvent.keyDown(inputBox, { key: 'Enter', code: 'Enter' })
    fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
    await waitFor(
      () =>
        expect(state.session.views[0].displayedRegions[0].assemblyName).toEqual(
          'volvox2',
        ),
      {
        timeout: 10000,
      },
    )
    autocomplete.focus()
    fireEvent.mouseDown(inputBox)
    fireEvent.change(inputBox, {
      target: { value: 'apple2' },
    })
    fireEvent.keyDown(autocomplete, { key: 'ArrowDown' })
    fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })
    // test search results dialog opening
    await screen.findByText('Search Results')
    expect(state.session.views[0].searchResults.length).toBeGreaterThan(0)
  }, 30000)

  it('opens reference sequence track and expects zoom in message', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { getAllByText, findByTestId } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_refseq'))
    state.session.views[0].setNewView(20, 0)
    await findByTestId(
      'display-volvox_refseq-LinearReferenceSequenceDisplay',
      {},
      { timeout: 10000 },
    )
    expect(getAllByText('Zoom in to see sequence')).toBeTruthy()
  }, 10000)

  it('click to display center line with correct value', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )

    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
    await findByTestId(
      'display-volvox_alignments_alignments',
      {},
      { timeout: 10000 },
    )

    // opens the view menu and selects show center line
    const viewMenu = await findByTestId('view_menu_icon')
    fireEvent.click(viewMenu)
    fireEvent.click(await findByText('Show center line'))
    expect(state.session.views[0].showCenterLine).toBe(true)

    const { centerLineInfo } = state.session.views[0]
    expect(centerLineInfo.refName).toBe('ctgA')
    expect(centerLineInfo.offset).toEqual(120)
  })

  it('test choose option from dropdown refName autocomplete', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByText, findByTestId, findByPlaceholderText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    expect(state.session.views[0].displayedRegions[0].refName).toEqual('ctgA')
    fireEvent.click(await findByText('Help'))
    // need this to complete before we can try to search
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
    await findByTestId(
      'trackRenderingContainer-integration_test-volvox_alignments',
      {},
      { timeout: 10000 },
    )

    const autocomplete = await findByTestId('autocomplete')
    const inputBox = await findByPlaceholderText('Search for location')
    fireEvent.mouseDown(inputBox)
    autocomplete.focus()
    fireEvent.keyDown(autocomplete, { key: 'ArrowDown' })
    fireEvent.keyDown(autocomplete, { key: 'ArrowDown' })
    const option = (await screen.findAllByText('ctgB'))[0]
    fireEvent.click(option)
    fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })

    await waitFor(
      () =>
        expect(state.session.views[0].displayedRegions[0].refName).toEqual(
          'ctgB',
        ),
      {
        timeout: 1000,
      },
    )
    expect((await findByPlaceholderText('Search for location')).value).toEqual(
      expect.stringContaining('ctgB'),
    )
  }, 30000)
})
