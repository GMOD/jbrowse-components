import React from 'react'
import '@testing-library/jest-dom/extend-expect'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import JBrowse from '../JBrowse'
import {
  setup,
  getPluginManager,
  expectCanvasMatch,
  generateReadBuffer,
} from './util'

expect.extend({ toMatchImageSnapshot })

setup()

afterEach(cleanup)

const readBuffer = generateReadBuffer(url => {
  return new LocalFile(require.resolve(`../../test_data/volvox/${url}`))
})

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
      if (request.url === 'volvox-sorted-altname.cram.crai') {
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
    await findAllByText(/HTTP 404/, {}, { timeout: 10000 })
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])
    expectCanvasMatch(
      await findByTestId(
        'prerendered_canvas_{volvox}ctgA:1..400-0',
        {},
        { timeout: 10000 },
      ),
    )
  }, 20000)

  it('reloads alignments track (CRAM 404)', async () => {
    console.error = jest.fn()

    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    fetch.mockResponse(async request => {
      if (request.url === 'volvox-sorted-altname.cram') {
        return { status: 404 }
      }
      return generateReadBuffer(url => {
        return new LocalFile(require.resolve(`../../test_data/volvox/${url}`))
      })(request)
    })

    const { findByTestId, findByText, findAllByTestId, findAllByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.5, 0)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_cram_snpcoverage'))
    await findAllByText(/HTTP 404/, {}, { timeout: 10000 })
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])
    expectCanvasMatch(
      await findByTestId(
        'prerendered_canvas_{volvox}ctgA:1..400-0',
        {},
        { timeout: 10000 },
      ),
    )
  }, 20000)
  it('reloads alignments track (BAI 404)', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    fetch.mockResponse(async request => {
      if (request.url === 'volvox-sorted-altname.bam.bai') {
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
    await findAllByText(/HTTP 404/, {}, { timeout: 10000 })
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])
    expectCanvasMatch(
      await findByTestId(
        'prerendered_canvas_{volvox}ctgA:1..400-0',
        {},
        { timeout: 10000 },
      ),
    )
  }, 20000)
  it('reloads alignments track (BAM 404)', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    fetch.mockResponse(async request => {
      if (request.url === 'volvox-sorted-altname.bam') {
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
    await findAllByText(/HTTP 404/, {}, { timeout: 10000 })
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])
    expectCanvasMatch(
      await findByTestId(
        'prerendered_canvas_{volvox}ctgA:1..400-0',
        {},
        { timeout: 10000 },
      ),
    )
  }, 20000)

  it('reloads bigwig (BW 404)', async () => {
    console.error = jest.fn()

    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    fetch.mockResponse(async request => {
      if (request.url === 'volvox_microarray.bw') {
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
    await findAllByText(/HTTP 404/, {}, { timeout: 10000 })
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])
    expectCanvasMatch(
      await findByTestId(
        'prerendered_canvas_{volvox}ctgA:1..8,000-0',
        {},
        { timeout: 10000 },
      ),
    )
  }, 20000)

  it('reloads vcf (VCF.GZ 404)', async () => {
    console.error = jest.fn()
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    fetch.mockResponse(async request => {
      if (request.url === 'volvox.filtered.vcf.gz') {
        return { status: 404 }
      }
      return readBuffer(request)
    })

    const { findByTestId, findByText, findAllByTestId, findAllByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))
    await findAllByText(/HTTP 404/, {}, { timeout: 10000 })
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])

    await findAllByTestId('box-test-vcf-604452', {}, { timeout: 10000 })
  }, 20000)

  it('reloads vcf (VCF.GZ.TBI 404)', async () => {
    console.error = jest.fn()
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    fetch.mockResponse(async request => {
      if (request.url === 'volvox.filtered.vcf.gz.tbi') {
        return { status: 404 }
      }
      return readBuffer(request)
    })

    const { findByTestId, findByText, findAllByTestId, findAllByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))
    await findAllByText(/HTTP 404/, {}, { timeout: 10000 })
    fetch.mockResponse(readBuffer)
    const buttons = await findAllByTestId('reload_button')
    fireEvent.click(buttons[0])

    await findAllByTestId('box-test-vcf-604452', {}, { timeout: 10000 })
  }, 20000)
})
