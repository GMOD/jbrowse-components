import React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

import {
  JBrowse,
  setup,
  generateReadBuffer,
  expectCanvasMatch,
  getPluginManager,
} from './util'

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

const delay = { timeout: 10000 }

describe('bigwig', () => {
  it('open a bigwig track', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(5, 0)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_microarray'))
    expectCanvasMatch(
      await findByTestId(
        'prerendered_canvas_{volvox}ctgA:1..4,000-0',
        {},
        delay,
      ),
    )
  }, 15000)
  it('open a bigwig line track 2', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(10, 0)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_microarray_line'))
    expectCanvasMatch(
      await findByTestId(
        'prerendered_canvas_{volvox}ctgA:1..8,000-0',
        {},
        delay,
      ),
    )
  }, 15000)
  it('open a bigwig density track', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(5, 0)
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_microarray_density'),
    )
    expectCanvasMatch(
      await findByTestId(
        'prerendered_canvas_{volvox}ctgA:1..4,000-0',
        {},
        delay,
      ),
    )
  }, 15000)
})
