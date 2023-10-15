import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { getConf } from '@jbrowse/core/configuration'

import masterConfig from '../../test_data/volvox/connection_test.json'
import {
  JBrowse,
  createView,
  setup,
  getPluginManager,
  doBeforeEach,
  mockConsoleWarn,
} from './util'
import userEvent from '@testing-library/user-event'

setup()
beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 10000 }

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

      const user = userEvent.setup()
      view.setNewView(0.05, 5000)
      await user.click(
        await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf', {}, delay),
      )
      await user.click(await findByText('Copy track'))
      await user.click(await findByText('volvox filtered vcf (copy)'))
      expect(queryByText(/Session tracks/)).toBeNull()
      await waitFor(() => expect(view.tracks.length).toBe(1))
      await findAllByTestId('box-test-vcf-604453', {}, delay)
      await user.click(await findByTestId('track_menu_icon'))
      await user.click(await findByText('Delete track'))
      await waitFor(() => expect(view.tracks.length).toBe(0))
    }),
  20000,
)

test(
  'copy and delete reference sequence track disabled',
  () =>
    mockConsoleWarn(async () => {
      const {
        view,
        rootModel,
        session,
        queryByText,
        findByTestId,
        findByText,
      } = await createView(undefined, true)

      // @ts-expect-error
      const { assemblyManager } = rootModel

      view.setNewView(0.05, 5000)
      const trackConf = getConf(assemblyManager.get('volvox'), 'sequence')

      // @ts-expect-error
      const trackMenuItems = session.getTrackActionMenuItems(trackConf)

      const user = userEvent.setup()
      // copy ref seq track disabled
      await user.click(
        await findByTestId('htsTrackEntryMenu-volvox_refseq', {}, delay),
      )
      await user.click(await findByText('Copy track'))
      expect(queryByText(/Session tracks/)).toBeNull()
      // clicking 'copy track' should not create a copy of a ref sequence track
      await waitFor(() => expect(view.tracks.length).toBe(0))
      expect(trackMenuItems[2].disabled).toBe(true)
      expect(trackMenuItems[3].disabled).toBe(true)
    }),
  10000,
)

test(
  'copy and delete track to session tracks',
  () =>
    mockConsoleWarn(async () => {
      const { view, findByTestId, findAllByTestId, findByText } =
        await createView(undefined, false)

      const user = userEvent.setup()
      view.setNewView(0.05, 5000)
      await user.click(
        await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf', {}, delay),
      )
      await user.click(await findByText('Copy track'))
      await user.click(await findByText('volvox filtered vcf (copy)'))
      await findByText(/Session tracks/)
      await waitFor(() => expect(view.tracks.length).toBe(1))
      await findAllByTestId('box-test-vcf-604453', {}, delay)
      await user.click(await findByTestId('track_menu_icon'))
      await user.click(await findByText('Delete track'))
      await waitFor(() => expect(view.tracks.length).toBe(0))
    }),
  10000,
)

xtest('delete connection', async () => {
  const pluginManager = getPluginManager(masterConfig, true)
  const { findAllByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )

  const user = userEvent.setup()
  const deleteButtons = await findAllByTestId('delete-connection')
  expect(deleteButtons.length).toBe(2)
  await user.click(deleteButtons[0])
  await user.click(await findByText('OK'))
  expect((await findAllByTestId('delete-connection')).length).toBe(1)
})
