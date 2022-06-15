import React from 'react'
import { fireEvent, render } from '@testing-library/react'
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
}, 20000)

test('bookmarks current region', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId, findByText } = render(<JBrowse pluginManager={pm} />)

  fireEvent.click(await findByTestId('view_menu_icon'))
  fireEvent.click(await findByText('Bookmark current region'))
  const { widgets } = state.session
  const { bookmarkedRegions } = widgets.get('GridBookmark')
  expect(bookmarkedRegions[0].start).toEqual(100)
  expect(bookmarkedRegions[0].end).toEqual(140)
}, 20000)

test('navigates to bookmarked region from widget', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel

  const { findByTestId, findByText } = render(<JBrowse pluginManager={pm} />)

  // need this to complete before we can try to navigate
  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox_alignments', {}, delay),
  )
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

  fireEvent.click(await findByText('ctgA:201..240'), {}, delay)
  const newRegion = view.getSelectedRegions(
    view.leftOffset,
    view.rightOffset,
  )[0]
  expect(newRegion.key).toEqual('{volvox}ctgA:201..240-0')
}, 20000)
