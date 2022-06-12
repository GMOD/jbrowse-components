import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
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
  const { session } = pluginManager.rootModel
  const { findByText, findAllByText, findByTestId } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  session.views[0].setNewView(30, 183)

  fireEvent.click(
    await findByTestId(
      'htsTrackEntry-volvox_cram_pileup',
      {},
      { timeout: 10000 },
    ),
  )

  await findAllByText(/Requested too much data/, {}, delay)
  const before = session.views[0].bpPerPx
  fireEvent.click(await findByTestId('zoom_in'))
  // found it helps avoid flaky test to check that it is zoomed in before
  // checking snapshot (even though it seems like it is unneeded) #2673
  await waitFor(() => expect(session.views[0].bpPerPx).toBe(before / 2), delay)

  expectCanvasMatch(
    await findByTestId(
      'prerendered_canvas_{volvox}ctgA:1..12,000-0',
      {},
      delay,
    ),
  )
}, 30000)

test('test stats estimation pileup, force load to see', async () => {
  const pluginManager = getPluginManager()
  const { session } = pluginManager.rootModel
  const { findByText, findAllByText, findByTestId } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  session.views[0].setNewView(25.07852564102564, 283)

  fireEvent.click(
    await findByTestId(
      'htsTrackEntry-volvox_cram_pileup',
      {},
      { timeout: 10000 },
    ),
  )

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
  const { session } = pluginManager.rootModel
  const { findByText, findAllByText, findAllByTestId, findByTestId } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  session.views[0].setNewView(34, 5)

  fireEvent.click(
    await findByTestId('htsTrackEntry-variant_colors', {}, { timeout: 10000 }),
  )

  await findAllByText(/Zoom in to see features/, {}, delay)
  const before = session.views[0].bpPerPx
  fireEvent.click(await findByTestId('zoom_in'))
  // found it helps avoid flaky test to check that it is zoomed in before
  // checking snapshot (even though it seems like it is unneeded) #2673
  await waitFor(() => expect(session.views[0].bpPerPx).toBe(before / 2), delay)

  await findAllByTestId('box-test-vcf-605560', {}, delay)
}, 30000)

test('test stats estimation on vcf track, force load to see', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByText, findAllByText, findByTestId } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(34, 5)
  await findAllByText('ctgA', {}, { timeout: 10000 })

  fireEvent.click(
    await findByTestId('htsTrackEntry-variant_colors', {}, { timeout: 10000 }),
  )

  await findAllByText(/Zoom in to see features/, {}, delay)
  const buttons = await findAllByText(/Force Load/, {}, delay)
  fireEvent.click(buttons[0])
  await findByTestId('box-test-vcf-605223', {}, delay)
}, 30000)
