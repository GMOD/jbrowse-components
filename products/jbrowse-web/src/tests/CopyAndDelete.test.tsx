/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React from 'react'
import '@testing-library/jest-dom/extend-expect'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { LocalFile } from 'generic-filehandle'
import { readConfObject } from '@jbrowse/core/configuration'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import masterConfig from '../../test_data/volvox/connection_test.json'
import { JBrowse, setup, getPluginManager, generateReadBuffer } from './util'

type LGV = LinearGenomeViewModel

expect.extend({ toMatchImageSnapshot })

setup()
beforeEach(() => {
  clearCache()
  clearAdapterCache()
  // @ts-ignore
  fetch.resetMocks()
  // @ts-ignore
  fetch.mockResponse(
    generateReadBuffer(
      url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
    ),
  )
})

const delay = { timeout: 10000 }

test('copy and delete track in admin mode', async () => {
  const pluginManager = getPluginManager(undefined, true)
  const state = pluginManager.rootModel!
  const view = state.session!.views[0] as LGV
  const { findByTestId, queryByText, findAllByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  view.setNewView(0.05, 5000)
  fireEvent.click(
    await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf', {}, delay),
  )
  fireEvent.click(await findByText('Copy track'))
  fireEvent.click(await findByText('volvox filtered vcf (copy)'))
  expect(queryByText(/Session tracks/)).toBeNull()
  await waitFor(() => expect(view.tracks.length).toBe(1))
  await findAllByTestId('box-test-vcf-604452', {}, delay)
  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Delete track'))
  await waitFor(() => expect(view.tracks.length).toBe(0))
}, 20000)

test('copy and delete reference sequence track disabled', async () => {
  const pluginManager = getPluginManager(undefined, true)
  const state = pluginManager.rootModel!
  const session = state.session!
  const view = session.views[0] as LGV
  const { assemblyManager } = session
  const { queryByText, findByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  view.setNewView(0.05, 5000)
  const testAssemblyConfig = assemblyManager.get('volvox')?.configuration
  const trackConf = readConfObject(testAssemblyConfig, 'sequence')

  // @ts-ignore
  const trackMenuItems = session!.getTrackActionMenuItems(trackConf)

  // copy ref seq track disbaled
  fireEvent.click(
    await findByTestId('htsTrackEntryMenu-volvox_refseq', {}, delay),
  )
  fireEvent.click(await findByText('Copy track'))
  expect(queryByText(/Session tracks/)).toBeNull()
  // clicking 'copy track' should not create a copy of a ref sequence track
  await waitFor(() => expect(view.tracks.length).toBe(0))
  expect(trackMenuItems[2].disabled).toBe(true)
  expect(trackMenuItems[3].disabled).toBe(true)
}, 20000)

test('copy and delete track to session tracks', async () => {
  const pluginManager = getPluginManager(undefined, false)
  const state = pluginManager.rootModel!
  const session = state.session!
  const view = session.views[0] as LGV
  const { findByTestId, findAllByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  view.setNewView(0.05, 5000)
  fireEvent.click(
    await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf', {}, delay),
  )
  fireEvent.click(await findByText('Copy track'))
  fireEvent.click(await findByText('volvox filtered vcf (copy)'))
  await findByText(/Session tracks/)
  await waitFor(() => expect(view.tracks.length).toBe(1))
  await findAllByTestId('box-test-vcf-604452', {}, delay)
  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Delete track'))
  await waitFor(() => expect(view.tracks.length).toBe(0))
}, 20000)

xtest('delete connection', async () => {
  const pluginManager = getPluginManager(masterConfig, true)
  const { findAllByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')

  const deleteButtons = await findAllByTestId('delete-connection')
  expect(deleteButtons.length).toBe(2)
  fireEvent.click(deleteButtons[0])
  fireEvent.click(await findByText('OK'))
  expect((await findAllByTestId('delete-connection')).length).toBe(1)
})
