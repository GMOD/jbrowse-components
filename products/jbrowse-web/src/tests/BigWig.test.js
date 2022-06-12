import React from 'react'
import { fireEvent, render } from '@testing-library/react'
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

const delay = { timeout: 10000 }

test('open a bigwig track', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId, findByText } = render(<JBrowse pluginManager={pm} />)
  await findByText('Help')
  state.session.views[0].setNewView(5, 0)
  fireEvent.click(
    await findByTestId(
      'htsTrackEntry-volvox_microarray',
      {},
      { timeout: 10000 },
    ),
  )
  expectCanvasMatch(
    await findByTestId('prerendered_canvas_{volvox}ctgA:1..4,000-0', {}, delay),
  )
}, 15000)
test('open a bigwig line track 2', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId, findByText } = render(<JBrowse pluginManager={pm} />)
  await findByText('Help')
  state.session.views[0].setNewView(10, 0)
  fireEvent.click(
    await findByTestId(
      'htsTrackEntry-volvox_microarray_line',
      {},
      { timeout: 10000 },
    ),
  )
  expectCanvasMatch(
    await findByTestId('prerendered_canvas_{volvox}ctgA:1..8,000-0', {}, delay),
  )
}, 15000)
test('open a bigwig density track', async () => {
  const pm = getPluginManager()
  const state = pm.rootModel
  const { findByTestId, findByText } = render(<JBrowse pluginManager={pm} />)
  await findByText('Help')
  state.session.views[0].setNewView(5, 0)
  fireEvent.click(
    await findByTestId(
      'htsTrackEntry-volvox_microarray_density',
      {},
      { timeout: 10000 },
    ),
  )
  expectCanvasMatch(
    await findByTestId('prerendered_canvas_{volvox}ctgA:1..4,000-0', {}, delay),
  )
}, 15000)
