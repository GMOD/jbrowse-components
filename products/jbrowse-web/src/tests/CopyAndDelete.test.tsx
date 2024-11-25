import React from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { fireEvent, render, waitFor } from '@testing-library/react'

import {
  JBrowse,
  createView,
  setup,
  getPluginManager,
  doBeforeEach,
  mockConsoleWarn,
} from './util'
import masterConfig from '../../test_data/volvox/connection_test.json'

setup()
beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 40000 }

// note: we mock out console because it gives a weird error on the
// CopyAndDelete test where it thinks "configuration" is stale/not alive in
// some place one way to fix in the production code is to add a
// getConf(track,'trackId') to the TrackContainer but this seems odd, so just
// silence the warning in test. exact warn is this:
//
// "Error: [mobx-state-tree] You are trying
// to read or write to an object that is no longer part of a state tree.
// (Object type: 'LinearVariantDisplay', Path upon death:
// '/session/views/0/tracks/0/displays/0', Subpath: 'configuration',
// Action: '/session.deleteTrackConf()'). Either detach nodes first, or
// don't use objects after removing / replacing them in the tree."
// const trackId = getConf(track, 'trackId')

test(
  'copy and delete track in admin mode',
  () =>
    mockConsoleWarn(async () => {
      const { view, findByTestId, queryByText, findAllByTestId, findByText } =
        await createView(undefined, true)

      view.setNewView(0.05, 5000)
      fireEvent.click(
        await findByTestId(
          'htsTrackEntryMenu-Tracks,volvox_filtered_vcf',
          {},
          delay,
        ),
      )
      fireEvent.click(await findByText('Copy track'))
      fireEvent.click(await findByText('volvox filtered vcf (copy)'))
      expect(queryByText(/Session tracks/)).toBeNull()
      await waitFor(() => {
        expect(view.tracks.length).toBe(1)
      })
      await findAllByTestId('box-test-vcf-604453', {}, delay)
      fireEvent.click(await findByTestId('track_menu_icon'))
      fireEvent.click(await findByText('Delete track'))
      await waitFor(() => {
        expect(view.tracks.length).toBe(0)
      })
    }),
  40000,
)

test(
  'copy and delete reference sequence track disabled',
  () =>
    mockConsoleWarn(async () => {
      const { view, session, queryByText, findByTestId, findByText } =
        await createView(undefined, true)

      const { assemblyManager } = session

      view.setNewView(0.05, 5000)
      const trackConf = getConf(assemblyManager.get('volvox')!, 'sequence')

      // @ts-expect-error
      const trackMenuItems = session.getTrackActionMenuItems(trackConf)

      // copy ref seq track disabled
      fireEvent.click(
        await findByTestId('htsTrackEntryMenu-Tracks,volvox_refseq', {}, delay),
      )
      fireEvent.click(await findByText('Copy track'))
      expect(queryByText(/Session tracks/)).toBeNull()
      // clicking 'copy track' should not create a copy of a ref sequence track
      await waitFor(() => {
        expect(view.tracks.length).toBe(0)
      })
      expect(trackMenuItems[2].disabled).toBe(true)
      expect(trackMenuItems[3].disabled).toBe(true)
    }),
  40000,
)

test(
  'copy and delete track to session tracks',
  () =>
    mockConsoleWarn(async () => {
      const { view, findByTestId, findAllByTestId, findByText } =
        await createView(undefined, false)

      view.setNewView(0.05, 5000)
      fireEvent.click(
        await findByTestId(
          'htsTrackEntryMenu-Tracks,volvox_filtered_vcf',
          {},
          delay,
        ),
      )
      fireEvent.click(await findByText('Copy track'))
      fireEvent.click(await findByText('volvox filtered vcf (copy)'))
      await findByText(/Session tracks/)
      await waitFor(() => {
        expect(view.tracks.length).toBe(1)
      })
      await findAllByTestId('box-test-vcf-604453', {}, delay)
      fireEvent.click(await findByTestId('track_menu_icon'))
      fireEvent.click(await findByText('Delete track'))
      await waitFor(() => {
        expect(view.tracks.length).toBe(0)
      })
    }),
  40000,
)

xtest('delete connection', async () => {
  const pluginManager = getPluginManager(masterConfig, true)
  const { findAllByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )

  const deleteButtons = await findAllByTestId('delete-connection')
  expect(deleteButtons.length).toBe(2)
  fireEvent.click(deleteButtons[0]!)
  fireEvent.click(await findByText('OK'))
  expect((await findAllByTestId('delete-connection')).length).toBe(1)
})
