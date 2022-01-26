import React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import {
  JBrowse,
  setup,
  expectCanvasMatch,
  generateReadBuffer,
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

const delay = { timeout: 20000 }

test('test stats estimation pileup, zoom in to see', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByText, findAllByText, findByTestId } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(25.07852564102564, 283)

  // load track
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_cram_pileup'))

  await findAllByText(/Requested too much data/, {}, delay)
  fireEvent.click(await findByTestId('zoom_in'))

  expectCanvasMatch(
    await findByTestId(
      'prerendered_canvas_{volvox}ctgA:20,065..30,096-0',
      {},
      delay,
    ),
  )
}, 30000)

test('test stats estimation pileup, force load to see', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByText, findAllByText, findByTestId } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(25.07852564102564, 283)

  // load track
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_cram_pileup'))

  await findAllByText(/Requested too much data/, {}, delay)
  const buttons = await findAllByText(/Force Load/, {}, delay)
  fireEvent.click(buttons[0])

  expectCanvasMatch(
    await findByTestId(
      'prerendered_canvas_{volvox}ctgA:1..20,063-0',
      {},
      delay,
    ),
  )
}, 30000)

test('test stats estimation on vcf track, zoom in to see', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByText, findAllByText, findByTestId } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(34, 5)

  // load track
  fireEvent.click(await findByTestId('htsTrackEntry-variant_colors'))

  await findAllByText(/Zoom in to see features/, {}, delay)
  fireEvent.click(await findByTestId('zoom_in'))
  await findByTestId('box-test-vcf-605560', {}, delay)
}, 30000)

test('test stats estimation on vcf track, force load to see', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByText, findAllByText, findByTestId } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(34, 5)

  // load track
  fireEvent.click(await findByTestId('htsTrackEntry-variant_colors'))

  await findAllByText(/Zoom in to see features/, {}, delay)
  const buttons = await findAllByText(/Force Load/, {}, delay)
  fireEvent.click(buttons[0])
  await findByTestId('box-test-vcf-605223', {}, delay)
}, 30000)
