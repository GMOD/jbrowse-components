import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { getConf } from '@jbrowse/core/configuration'

import masterConfig from '../../test_data/volvox/connection_test.json'
import {
  JBrowse,
  createView,
  setup,
  getPluginManager,
  doBeforeEach,
} from './util'

setup()
beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 40000 }

test('copy and delete track in admin mode', async () => {
  const { view, findByTestId, queryByText, findAllByTestId, findByText } =
    await createView(undefined, true)

  await findByText('Help')
  view.setNewView(0.05, 5000)
  fireEvent.click(
    await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf', {}, delay),
  )
  fireEvent.click(await findByText('Copy track'))
  fireEvent.click(await findByText('volvox filtered vcf (copy)'))
  expect(queryByText(/Session tracks/)).toBeNull()
  await waitFor(() => expect(view.tracks.length).toBe(1))
  await findAllByTestId('box-test-vcf-604453', {}, delay)
  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Delete track'))
  await waitFor(() => expect(view.tracks.length).toBe(0))
}, 40000)

test('copy and delete reference sequence track disabled', async () => {
  const { view, rootModel, session, queryByText, findByTestId, findByText } =
    await createView(undefined, true)

  // @ts-expect-error
  const { assemblyManager } = rootModel

  await findByText('Help')
  view.setNewView(0.05, 5000)
  const trackConf = getConf(assemblyManager.get('volvox'), 'sequence')

  // @ts-expect-error
  const trackMenuItems = session.getTrackActionMenuItems(trackConf)

  // copy ref seq track disabled
  fireEvent.click(
    await findByTestId('htsTrackEntryMenu-volvox_refseq', {}, delay),
  )
  fireEvent.click(await findByText('Copy track'))
  expect(queryByText(/Session tracks/)).toBeNull()
  // clicking 'copy track' should not create a copy of a ref sequence track
  await waitFor(() => expect(view.tracks.length).toBe(0))
  expect(trackMenuItems[2].disabled).toBe(true)
  expect(trackMenuItems[3].disabled).toBe(true)
}, 40000)

test('copy and delete track to session tracks', async () => {
  const { view, findByTestId, findAllByTestId, findByText } = await createView(
    undefined,
    false,
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
  await findAllByTestId('box-test-vcf-604453', {}, delay)
  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Delete track'))
  await waitFor(() => expect(view.tracks.length).toBe(0))
}, 40000)

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
