import React from 'react'
import '@testing-library/jest-dom/extend-expect'

import { act } from 'react-dom/test-utils'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { fireEvent, render, getByRole } from '@testing-library/react'
import { JBrowse, getPluginManager, generateReadBuffer } from './util'

const delay = { timeout: 15000 }

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(
    generateReadBuffer(
      url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
    ),
  )
})

test('variant track test - opens feature detail view', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId, findAllByTestId, findByText } = render(
    <JBrowse pluginManager={pm} />,
  )
  await findByText('Help')
  const view = state.session.views[0]
  act(() => view.setNewView(0.05, 5000))
  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox_filtered_vcf', {}, delay),
  )
  act(() =>
    view.tracks[0].displays[0].setFeatureIdUnderMouse('test-vcf-604452'),
  )
  const feats1 = await findAllByTestId('test-vcf-604452', {}, delay)
  fireEvent.click(feats1[0])

  // this text is to confirm a feature detail drawer opened
  expect(await findByTestId('variant-side-drawer')).toBeInTheDocument()
  const feats2 = await findAllByTestId('test-vcf-604452', {}, delay)
  fireEvent.contextMenu(feats2[0])
  fireEvent.click(await findByText('Open feature details'))
  expect(await findByTestId('variant-side-drawer')).toBeInTheDocument()
}, 20000)

test('widget drawer navigation', async () => {
  const pm = getPluginManager(undefined, true)
  const state = pm.rootModel
  const { findByTestId, findByText } = render(<JBrowse pluginManager={pm} />)
  await findByText('Help')
  act(() => state.session.views[0].setNewView(0.05, 5000))
  // opens a config editor widget
  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox_filtered_vcf', {}, delay),
  )
  fireEvent.click(
    await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf', {}, delay),
  )
  fireEvent.click(await findByText('Settings'))
  await findByTestId('configEditor', {}, delay)
  // shows up when there active widgets
  fireEvent.mouseDown(
    getByRole(await findByTestId('widget-drawer-selects'), 'button'),
  )
  fireEvent.click(
    await findByTestId(
      'widget-drawer-selects-item-HierarchicalTrackSelectorWidget',
    ),
  )
  await findByTestId('hierarchical_track_selector')

  // test minimize and maximize widget drawer
  expect(state.session.minimized).toBeFalsy()

  await findByTestId('drawer-minimize')
  fireEvent.click(await findByTestId('drawer-minimize'))
  expect(state.session.minimized).toBeTruthy()

  fireEvent.click(await findByTestId('drawer-maximize'))
  expect(state.session.minimized).toBeFalsy()

  // test deleting widget from select dropdown using trash icon
  expect(state.session.activeWidgets.size).toEqual(2)
  fireEvent.mouseDown(
    getByRole(await findByTestId('widget-drawer-selects'), 'button'),
  )
  fireEvent.click(await findByTestId('ConfigurationEditorWidget-drawer-delete'))
  expect(state.session.activeWidgets.size).toEqual(1)
}, 20000)
