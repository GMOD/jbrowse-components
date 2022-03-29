import React from 'react'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
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
describe('alignments track', () => {
  it('opens an alignments track', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText, findAllByTestId } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(5, 100)
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_alignments_pileup_coverage'),
    )

    const { findByTestId: findByTestId1 } = within(
      await findByTestId('Blockset-pileup', {}, delay),
    )
    expectCanvasMatch(
      await findByTestId1(
        'prerendered_canvas_{volvox}ctgA:1..4,000-0',
        {},
        delay,
      ),
    )

    const { findByTestId: findByTestId2 } = within(
      await findByTestId('Blockset-snpcoverage', {}, delay),
    )
    expectCanvasMatch(
      await findByTestId2(
        'prerendered_canvas_{volvox}ctgA:1..4,000-0',
        {},
        delay,
      ),
    )

    const track = await findAllByTestId('pileup_overlay_canvas')
    fireEvent.mouseMove(track[0], { clientX: 200, clientY: 20 })
    fireEvent.click(track[0], { clientX: 200, clientY: 40 })
    fireEvent.mouseDown(track[0], { clientX: 200, clientY: 20 })
    fireEvent.mouseMove(track[0], { clientX: 300, clientY: 20 })
    fireEvent.mouseUp(track[0], { clientX: 300, clientY: 20 })
    fireEvent.mouseMove(track[0], { clientX: -100, clientY: -100 })

    // this is to confirm a alignment detail widget opened
    await findByTestId('alignment-side-drawer')
  }, 20000)

  it('test that bam with small max height displays message', async () => {
    const pluginManager = getPluginManager()
    const { findByTestId, findAllByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_bam_small_max_height'),
    )

    await findAllByText('Max height reached', {}, delay)
  }, 30000)

  it('test snpcoverage doesnt count snpcoverage', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByText, findByTestId } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.03932, 67884.16536402702)

    // load track
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox-long-reads-sv-cram'),
    )

    const { findByTestId: findByTestId1 } = within(
      await findByTestId('Blockset-snpcoverage', {}, delay),
    )

    expectCanvasMatch(
      await findByTestId1(
        'prerendered_canvas_{volvox}ctgA:2,657..2,688-0',
        {},
        delay,
      ),
    )
    expectCanvasMatch(
      await findByTestId1(
        'prerendered_canvas_{volvox}ctgA:2,689..2,720-0',
        {},
        delay,
      ),
    )
  }, 30000)
})
