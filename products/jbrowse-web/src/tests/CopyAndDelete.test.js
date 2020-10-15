// library
import '@testing-library/jest-dom/extend-expect'

import {
  cleanup,
  fireEvent,
  render,
  wait,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import React from 'react'
import { LocalFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/rangeFetcher'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import JBrowse from '../JBrowse'
import { setup, getPluginManager, generateReadBuffer } from './util'

expect.extend({ toMatchImageSnapshot })

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

test('copy track', async () => {
  const pluginManager = getPluginManager(undefined, true)
  const state = pluginManager.rootModel
  const { findByTestId, getByTestId, findAllByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(0.05, 5000)
  fireEvent.click(await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf'))
  fireEvent.click(await findByText('Copy track'))
  fireEvent.click(await findByText('volvox filtered vcf (copy)'))
  await wait(() => expect(state.session.views[0].tracks.length).toBe(1))
  const element = await findAllByTestId('box-test-vcf-604452')
  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Delete track'))
  await wait(() => expect(state.session.views[0].tracks.length).toBe(0))
})
