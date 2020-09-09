// library
import '@testing-library/jest-dom/extend-expect'

import { cleanup, fireEvent, render } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import React from 'react'

// locals
import { clearCache } from '@gmod/jbrowse-core/util/io/rangeFetcher'
import { clearAdapterCache } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import JBrowse from '../JBrowse'
import { setup, getPluginManager, readBuffer } from './util'

expect.extend({ toMatchImageSnapshot })

setup()

afterEach(cleanup)

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(readBuffer)
})

// this tests reloading after an initial track error
// it performs a full image snapshot test to ensure that the features are rendered and not
// just that an empty canvas is rendered (empty canvas can result if ref name renaming failed)
describe('reload tests', () => {
  it('reloads alignments track (CRAI 404)', async () => {
    console.error = jest.fn()

    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    fetch.mockResponse(async request => {
      if (request.url === 'test_data/volvox/volvox-sorted-altname.cram.crai') {
        return { status: 404 }
      }
      return readBuffer(request)
    })

    const { findByTestId, findByText, findAllByTestId, findAllByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.5, 0)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_cram_pileup'))
    await findAllByText(/HTTP 404/)
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])
    const canvas = await findAllByTestId('prerendered_canvas')
    const pileupImg = canvas[0].toDataURL()
    const pileupData = pileupImg.replace(/^data:image\/\w+;base64,/, '')
    const pileupBuf = Buffer.from(pileupData, 'base64')
    expect(pileupBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  }, 10000)

  it('reloads alignments track (CRAM 404)', async () => {
    console.error = jest.fn()

    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    fetch.mockResponse(async request => {
      if (request.url === 'test_data/volvox/volvox-sorted-altname.cram') {
        return { status: 404 }
      }
      return readBuffer(request)
    })

    const { findByTestId, findByText, findAllByTestId, findAllByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.5, 0)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_cram_snpcoverage'))
    await findAllByText(/HTTP 404/)
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])
    const canvas = await findAllByTestId('prerendered_canvas')
    const pileupImg = canvas[0].toDataURL()
    const pileupData = pileupImg.replace(/^data:image\/\w+;base64,/, '')
    const pileupBuf = Buffer.from(pileupData, 'base64')
    expect(pileupBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  }, 10000)
  it('reloads alignments track (BAI 404)', async () => {
    console.error = jest.fn()

    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    fetch.mockResponse(async request => {
      if (request.url === 'test_data/volvox/volvox-sorted-altname.bam.bai') {
        return { status: 404 }
      }
      return readBuffer(request)
    })

    const { findByTestId, findByText, findAllByTestId, findAllByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.5, 0)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_bam_snpcoverage'))
    await findAllByText(/HTTP 404/)
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])
    const canvas = await findAllByTestId('prerendered_canvas')
    const pileupImg = canvas[0].toDataURL()
    const pileupData = pileupImg.replace(/^data:image\/\w+;base64,/, '')
    const pileupBuf = Buffer.from(pileupData, 'base64')
    expect(pileupBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  }, 10000)
  it('reloads alignments track (BAM 404)', async () => {
    console.error = jest.fn()

    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    fetch.mockResponse(async request => {
      if (request.url === 'test_data/volvox/volvox-sorted-altname.bam') {
        return { status: 404 }
      }
      return readBuffer(request)
    })

    const { findByTestId, findByText, findAllByTestId, findAllByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.5, 0)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_bam_pileup'))
    await findAllByText(/HTTP 404/)
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])
    const canvas = await findAllByTestId('prerendered_canvas')
    const pileupImg = canvas[0].toDataURL()
    const pileupData = pileupImg.replace(/^data:image\/\w+;base64,/, '')
    const pileupBuf = Buffer.from(pileupData, 'base64')
    expect(pileupBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  }, 10000)

  it('reloads bigwig (BW 404)', async () => {
    console.error = jest.fn()

    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    fetch.mockResponse(async request => {
      if (request.url === 'test_data/volvox/volvox_microarray.bw') {
        return { status: 404 }
      }
      return readBuffer(request)
    })

    const { findByTestId, findByText, findAllByTestId, findAllByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(10, 0)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_microarray'))
    await findAllByText(/HTTP 404/)
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])
    const canvas = await findAllByTestId('prerendered_canvas')
    const bigwigImg = canvas[0].toDataURL()
    const bigwigData = bigwigImg.replace(/^data:image\/\w+;base64,/, '')
    const bigwigBuf = Buffer.from(bigwigData, 'base64')
    expect(bigwigBuf).toMatchImageSnapshot({
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })
  }, 10000)
})
