import React from 'react'
import {
  createEvent,
  fireEvent,
  render,
  waitFor,
  screen,
} from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { JBrowse, setup, generateReadBuffer, getPluginManager } from './util'

setup()

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

const delay = { timeout: 10000 }

test('access about menu', async () => {
  const pm = getPluginManager()
  const { findByText } = render(<JBrowse pluginManager={pm} />)

  fireEvent.click(await findByText('Help'))
  fireEvent.click(await findByText('About'))

  const dlg = await findByText(/The Evolutionary Software Foundation/)
  expect(dlg).toBeTruthy()
})

test('click and drag to move sideways', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId } = render(<JBrowse pluginManager={pm} />)
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))

  const start = state.session.views[0].offsetPx
  const track = await findByTestId(
    'display-volvox_alignments_alignments',
    {},
    delay,
  )
  fireEvent.mouseDown(track, { clientX: 250, clientY: 20 })
  fireEvent.mouseMove(track, { clientX: 100, clientY: 20 })
  fireEvent.mouseUp(track, { clientX: 100, clientY: 20 })
  // wait for requestAnimationFrame
  await waitFor(() => {})
  const end = state.session.views[0].offsetPx
  expect(end - start).toEqual(150)
}, 10000)

test('click and drag to rubberBand', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId, findByText } = render(<JBrowse pluginManager={pm} />)
  const track = await findByTestId('rubberBand_controls', {}, delay)

  expect(state.session.views[0].bpPerPx).toEqual(0.05)
  fireEvent.mouseDown(track, { clientX: 100, clientY: 0 })
  fireEvent.mouseMove(track, { clientX: 250, clientY: 0 })
  fireEvent.mouseUp(track, { clientX: 250, clientY: 0 })
  const zoomMenuItem = await findByText('Zoom to region')
  fireEvent.click(zoomMenuItem)
  expect(state.session.views[0].bpPerPx).toEqual(0.02)
}, 15000)

test('click and drag rubberBand, click get sequence to open sequenceDialog', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId, findByText } = render(<JBrowse pluginManager={pm} />)
  const rubberBandComponent = await findByTestId(
    'rubberBand_controls',
    {},
    delay,
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

test('click and drag rubberBand, bookmarks region', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId, findByText } = render(<JBrowse pluginManager={pm} />)
  const rubberBandComponent = await findByTestId(
    'rubberBand_controls',
    {},
    delay,
  )

  expect(state.session.views[0].bpPerPx).toEqual(0.05)
  fireEvent.mouseDown(rubberBandComponent, { clientX: 100, clientY: 0 })
  fireEvent.mouseMove(rubberBandComponent, { clientX: 250, clientY: 0 })
  fireEvent.mouseUp(rubberBandComponent, { clientX: 250, clientY: 0 })
  const bookmarkMenuItem = await findByText('Bookmark region')
  fireEvent.click(bookmarkMenuItem)
  const { widgets } = state.session
  const bookmarkWidget = widgets.get('GridBookmark')
  expect(bookmarkWidget.bookmarkedRegions[0].assemblyName).toEqual('volvox')
})

test('click and drag to reorder tracks', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId } = render(<JBrowse pluginManager={pm} />)
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))

  const view = state.session.views[0]
  const trackId1 = view.tracks[1].id
  const dragHandle0 = await findByTestId(
    'dragHandle-integration_test-volvox_alignments',
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
}, 15000)

test('click and zoom in and back out', async () => {
  const pm = getPluginManager()
  const { session } = pm.rootModel
  const { findByTestId, findAllByText } = render(<JBrowse pluginManager={pm} />)
  await findAllByText('ctgA', {}, { timeout: 10000 })
  const view = session.views[0]
  const before = view.bpPerPx
  fireEvent.click(await findByTestId('zoom_in'))
  await waitFor(() => expect(view.bpPerPx).toBe(before / 2), delay)
  expect(view.bpPerPx).toBe(before / 2)
  fireEvent.click(await findByTestId('zoom_out'))
  await waitFor(() => expect(view.bpPerPx).toBe(before), delay)
  expect(view.bpPerPx).toBe(before)
}, 30000)

test('opens track selector', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId } = render(<JBrowse pluginManager={pm} />)

  await findByTestId('htsTrackEntry-volvox_alignments')
  expect(state.session.views[0].tracks.length).toBe(0)
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
  expect(state.session.views[0].tracks.length).toBe(1)
})

test('opens reference sequence track and expects zoom in message', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { getAllByText, findByTestId } = render(<JBrowse pluginManager={pm} />)
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_refseq'))
  state.session.views[0].setNewView(20, 0)
  await findByTestId(
    'display-volvox_refseq-LinearReferenceSequenceDisplay',
    {},
    delay,
  )
  expect(getAllByText('Zoom in to see sequence')).toBeTruthy()
}, 30000)

test('click to display center line with correct value', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId, findByText } = render(<JBrowse pluginManager={pm} />)

  fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
  await findByTestId('display-volvox_alignments_alignments', {}, delay)

  // opens the view menu and selects show center line
  const viewMenu = await findByTestId('view_menu_icon')
  fireEvent.click(viewMenu)
  fireEvent.click(await findByText('Show center line'))
  expect(state.session.views[0].showCenterLine).toBe(true)

  const { centerLineInfo } = state.session.views[0]
  expect(centerLineInfo.refName).toBe('ctgA')
  expect(centerLineInfo.offset).toEqual(120)
})

test('bookmarks current region', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId, findByText } = render(<JBrowse pluginManager={pm} />)

  const viewMenu = await findByTestId('view_menu_icon')
  fireEvent.click(viewMenu)
  fireEvent.click(await findByText('Bookmark current region'))
  const { widgets } = state.session
  const bookmarkWidget = widgets.get('GridBookmark')
  expect(bookmarkWidget.bookmarkedRegions[0].start).toEqual(100)
  expect(bookmarkWidget.bookmarkedRegions[0].end).toEqual(140)
})

test('navigates to bookmarked region from widget', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel

  const { findByTestId, findByText } = render(<JBrowse pluginManager={pm} />)

  // need this to complete before we can try to navigate
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
  await findByTestId(
    'trackRenderingContainer-integration_test-volvox_alignments',
    {},
    delay,
  )

  const viewMenu = await findByTestId('view_menu_icon')
  fireEvent.click(viewMenu)
  fireEvent.click(await findByText('Open bookmark widget'))

  const { widgets } = state.session
  const bookmarkWidget = widgets.get('GridBookmark')
  bookmarkWidget.addBookmark({
    start: 200,
    end: 240,
    refName: 'ctgA',
    assemblyName: 'volvox',
  })
  const view = state.session.views[0]

  fireEvent.click(await findByText('ctgA:201..240'))
  const newRegion = view.getSelectedRegions(
    view.leftOffset,
    view.rightOffset,
  )[0]
  expect(newRegion.key).toEqual('{volvox}ctgA:201..240-0')
})

test('test choose option from dropdown refName autocomplete', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByText, findByTestId, findByPlaceholderText } = render(
    <JBrowse pluginManager={pm} />,
  )
  const view = state.session.views[0]
  expect(view.displayedRegions[0].refName).toEqual('ctgA')
  fireEvent.click(await findByText('Help'))
  // need this to complete before we can try to search
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
  await findByTestId(
    'trackRenderingContainer-integration_test-volvox_alignments',
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
  const option = (await screen.findAllByText('ctgB'))[0]
  fireEvent.click(option)
  fireEvent.keyDown(autocomplete, { key: 'Enter', code: 'Enter' })

  await waitFor(
    () => expect(view.displayedRegions[0].refName).toEqual('ctgB'),
    delay,
  )
  expect((await findByPlaceholderText('Search for location')).value).toEqual(
    expect.stringContaining('ctgB'),
  )
})
