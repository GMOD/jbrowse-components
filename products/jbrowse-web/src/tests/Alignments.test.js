// library
import {
  cleanup,
  fireEvent,
  render,
  within,
  waitForElement,
} from '@testing-library/react'
import React from 'react'
import { LocalFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/rangeFetcher'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { setup, generateReadBuffer, getPluginManager } from './util'
import JBrowse from '../JBrowse'

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

    const { findAllByTestId: findAllByTestId1 } = within(
      await findByTestId('Blockset-pileup'),
    )
    const pileupCanvas = await findAllByTestId1('prerendered_canvas')
    const pileupImg = pileupCanvas[0].toDataURL()
    const pileupData = pileupImg.replace(/^data:image\/\w+;base64,/, '')
    const pileupBuf = Buffer.from(pileupData, 'base64')
    expect(pileupBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })

    const { findAllByTestId: findAllByTestId2 } = within(
      await findByTestId('Blockset-snpcoverage'),
    )
    const snpCoverageCanvas = await findAllByTestId2('prerendered_canvas')
    const snpCoverageImg = snpCoverageCanvas[0].toDataURL()
    const snpCoverageData = snpCoverageImg.replace(
      /^data:image\/\w+;base64,/,
      '',
    )
    const snpCoverageBuf = Buffer.from(snpCoverageData, 'base64')
    expect(snpCoverageBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })

    const track = await findAllByTestId('pileup_overlay_canvas')
    fireEvent.mouseMove(track[0], { clientX: 200, clientY: 20 })

    fireEvent.click(track[0], { clientX: 200, clientY: 40 })

    fireEvent.mouseDown(track[0], { clientX: 200, clientY: 20 })
    fireEvent.mouseMove(track[0], { clientX: 300, clientY: 20 })
    fireEvent.mouseUp(track[0], { clientX: 300, clientY: 20 })
    fireEvent.mouseMove(track[0], { clientX: -100, clientY: -100 })

    // this is to confirm a alignment detail widget opened
    await expect(findAllByTestId('alignment-side-drawer')).resolves.toBeTruthy()
  }, 15000)

  // Note: tracks with assembly volvox don't have much soft clipping
  it('opens the track menu and enables soft clipping', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText, getByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.5, 5200)

    // load track
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox-long-reads-sv-bam'),
    )
    await findByTestId(
      'display-volvox-long-reads-sv-bam-LinearAlignmentsDisplay',
    )
    expect(state.session.views[0].tracks[0]).toBeTruthy()

    // opens the track menu and turns on soft clipping
    const trackMenu = await findByTestId('track_menu_icon')
    fireEvent.click(trackMenu)

    await waitForElement(() => getByText('Show soft clipping'))
    fireEvent.click(getByText('Show soft clipping'))

    // wait for block to rerender after softclipping
    const { findAllByTestId: findAllByTestId1 } = within(
      await findByTestId('Blockset-pileup'),
    )

    const pileupCanvas = await findAllByTestId1(
      'prerendered_canvas_softclipped',
    )
    const pileupImg = pileupCanvas[0].toDataURL()
    const pileupData = pileupImg.replace(/^data:image\/\w+;base64,/, '')
    const pileupBuf = Buffer.from(pileupData, 'base64')
    expect(pileupBuf).toMatchImageSnapshot()
  }, 12000)

  it('selects a sort, updates object and layout', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText, findAllByTestId } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.02, 2086500)

    // load track
    fireEvent.click(await findByTestId('htsTrackEntry-volvox-long-reads-cram'))
    await findByTestId('display-volvox-long-reads-cram-LinearAlignmentsDisplay')
    expect(state.session.views[0].tracks[0]).toBeTruthy()

    // opens the track menu and turns on soft clipping
    const trackMenu = await findByTestId('track_menu_icon')

    fireEvent.click(trackMenu)
    fireEvent.click(await findByText('Sort by'))
    fireEvent.click(await findByText('Read strand'))

    // wait for pileup track to render with sort
    await findAllByTestId('pileup-Read strand')

    // wait for pileup track to render
    const { findAllByTestId: findAllByTestId1 } = within(
      await findByTestId('Blockset-pileup'),
    )
    const canvases = await findAllByTestId1('prerendered_canvas')
    const img = canvases[1].toDataURL()
    const data = img.replace(/^data:image\/\w+;base64,/, '')
    const buf = Buffer.from(data, 'base64')
    expect(buf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  }, 10000)

  it('test that bam with small max height displays message', async () => {
    const pluginManager = getPluginManager()
    const { findByTestId, findAllByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_bam_small_max_height'),
    )
    await findAllByText('Max height reached')
  })
})
