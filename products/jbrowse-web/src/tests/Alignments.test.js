// library
import {
  cleanup,
  waitFor,
  fireEvent,
  render,
  within,
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

    const { findAllByTestId: findAllByTestId1 } = within(
      await findByTestId('Blockset-pileup', {}, delay),
    )
    const pileupCanvas = await findAllByTestId1('prerendered_canvas', {}, delay)
    const pileupImg = pileupCanvas[0].toDataURL()
    const pileupData = pileupImg.replace(/^data:image\/\w+;base64,/, '')
    const pileupBuf = Buffer.from(pileupData, 'base64')
    expect(pileupBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })

    const { findAllByTestId: findAllByTestId2 } = within(
      await findByTestId('Blockset-snpcoverage', {}, delay),
    )
    const snpCovCanvas = await findAllByTestId2('prerendered_canvas', {}, delay)
    const snpCovImg = snpCovCanvas[0].toDataURL()
    const snpCovData = snpCovImg.replace(/^data:image\/\w+;base64,/, '')
    const snpCovBuf = Buffer.from(snpCovData, 'base64')
    expect(snpCovBuf).toMatchImageSnapshot({
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
    await findByTestId('alignment-side-drawer')
  }, 20000)

  // Note: tracks with assembly volvox don't have much soft clipping
  it('opens the track menu and enables soft clipping', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.02, 142956)

    // load track
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox-long-reads-sv-bam'),
    )
    await findByTestId(
      'display-volvox-long-reads-sv-bam-LinearAlignmentsDisplay',
    )
    expect(state.session.views[0].tracks[0]).toBeTruthy()

    // opens the track menu
    fireEvent.click(await findByTestId('track_menu_icon'))
    fireEvent.click(await findByText('Show soft clipping'))

    // wait for block to rerender
    const { findAllByTestId: findAllByTestId1 } = within(
      await findByTestId('Blockset-pileup'),
    )

    const pileupCanvas = await findAllByTestId1(
      'prerendered_canvas_softclipped',
      {},
      delay,
    )
    const pileupImg = pileupCanvas[0].toDataURL()
    const pileupData = pileupImg.replace(/^data:image\/\w+;base64,/, '')
    const pileupBuf = Buffer.from(pileupData, 'base64')
    expect(pileupBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  }, 20000)

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
    await findByTestId(
      'display-volvox-long-reads-cram-LinearAlignmentsDisplay',
      {},
      delay,
    )
    expect(state.session.views[0].tracks[0]).toBeTruthy()

    // opens the track menu
    const trackMenu = await findByTestId('track_menu_icon')

    fireEvent.click(trackMenu)
    fireEvent.click(await findByText('Sort by'))
    fireEvent.click(await findByText('Read strand'))

    // wait for pileup track to render with sort
    await findAllByTestId('pileup-Read strand', {}, delay)

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
  }, 20000)

  it('selects a color, updates object and layout', async () => {
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
    fireEvent.click(await findByTestId('track_menu_icon'))
    fireEvent.click(await findByText('Color scheme'))
    fireEvent.click(await findByText('Strand'))

    // wait for pileup track to render with color
    await findAllByTestId('pileup-strand', {}, delay)

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
  }, 20000)

  it('colors by tag, updates object and layout', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText, findAllByTestId } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.465, 85055)

    // load track
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_cram'))
    await findByTestId('display-volvox_cram-LinearAlignmentsDisplay')
    expect(state.session.views[0].tracks[0]).toBeTruthy()

    // opens the track menu
    const trackMenu = await findByTestId('track_menu_icon')

    // colors by HP tag
    fireEvent.click(trackMenu)
    fireEvent.click(await findByText('Color scheme'))
    fireEvent.click(await findByText('Color by tag...'))
    fireEvent.change(await findByTestId('color-tag-name-input'), {
      target: { value: 'HP' },
    })
    fireEvent.click(await findByText('Submit'))

    // wait for pileup track to render with color
    await findAllByTestId('pileup-tagHP', {}, delay)

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
  }, 20000)

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

    const { findAllByTestId } = within(
      await findByTestId('Blockset-snpcoverage'),
    )

    await waitFor(async () => {
      const canvases = await findAllByTestId('prerendered_canvas')
      expect(canvases.length).toBe(2)
    }, delay)
    const snpCoverageCanvas = await findAllByTestId('prerendered_canvas')

    // this block tests that softclip avoids decrementing the total block
    // e.g. this line is not called for softclip/hardclip
    // bin.getNested('reference').decrement(strand, overlap)
    expect(
      Buffer.from(
        snpCoverageCanvas[0]
          .toDataURL()
          .replace(/^data:image\/\w+;base64,/, ''),
        'base64',
      ),
    ).toMatchImageSnapshot()

    // test that softclip doesn't contibute to coverage
    expect(
      Buffer.from(
        snpCoverageCanvas[1]
          .toDataURL()
          .replace(/^data:image\/\w+;base64,/, ''),
        'base64',
      ),
    ).toMatchImageSnapshot()
  }, 15000)
})
