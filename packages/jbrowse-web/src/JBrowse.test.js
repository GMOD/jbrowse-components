// library
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import '@testing-library/jest-dom/extend-expect'
import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  wait,
  waitForElement,
  within,
} from '@testing-library/react'
import { TextDecoder, TextEncoder } from 'fastestsmallesttextencoderdecoder'
import { LocalFile } from 'generic-filehandle'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import rangeParser from 'range-parser'
import React from 'react'
import ErrorBoundary from 'react-error-boundary'

// locals
import { clearCache } from '@gmod/jbrowse-core/util/io/rangeFetcher'
import { clearAdapterCache } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import breakpointConfig from '../test_data/breakpoint/config.json'
import chromeSizesConfig from '../test_data/config_chrom_sizes_test.json'
import dotplotConfig from '../test_data/config_dotplot.json'
import configSnapshot from '../test_data/volvox/config.json'
import corePlugins from './corePlugins'
import JBrowse from './JBrowse'
import JBrowseRootModelFactory from './rootModel'

configSnapshot.configuration = {
  rpc: {
    defaultDriver: 'MainThreadRpcDriver',
  },
  useUrlSession: false,
}

if (!window.TextEncoder) window.TextEncoder = TextEncoder
if (!window.TextDecoder) window.TextDecoder = TextDecoder

expect.extend({ toMatchImageSnapshot })

window.requestIdleCallback = cb => cb()
window.cancelIdleCallback = () => {}
window.requestAnimationFrame = cb => setTimeout(cb)
window.cancelAnimationFrame = () => {}

Storage.prototype.getItem = jest.fn(() => null)
Storage.prototype.setItem = jest.fn()
Storage.prototype.removeItem = jest.fn()
Storage.prototype.clear = jest.fn()

function getPluginManager(initialState, adminMode = false) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()

  const JBrowseRootModel = JBrowseRootModelFactory(pluginManager, adminMode)
  const rootModel = JBrowseRootModel.create({
    jbrowse: initialState || configSnapshot,
    assemblyManager: {},
  })
  if (rootModel.jbrowse && rootModel.jbrowse.savedSessions.length) {
    const { name } = rootModel.jbrowse.savedSessions[0]
    rootModel.activateSession(name)
  } else {
    rootModel.setDefaultSession()
  }
  pluginManager.setRootModel(rootModel)

  pluginManager.configure()
  return pluginManager
}

const getFile = url => new LocalFile(require.resolve(`../${url}`))
// fakes server responses from local file object with fetchMock
const readBuffer = async request => {
  try {
    const file = getFile(request.url)
    const maxRangeRequest = 1000000 // kind of arbitrary, part of the rangeParser
    if (request.headers.get('range')) {
      const range = rangeParser(maxRangeRequest, request.headers.get('range'))
      if (range === -2 || range === -1) {
        throw new Error(`Error parsing range "${request.headers.get('range')}"`)
      }
      const { start, end } = range[0]
      const len = end - start + 1
      const buf = Buffer.alloc(len)
      const { bytesRead } = await file.read(buf, 0, len, start)
      const stat = await file.stat()
      return new Response(buf.slice(0, bytesRead), {
        status: 206,
        headers: [['content-range', `${start}-${end}/${stat.size}`]],
      })
    }
    const body = await file.readFile()
    return new Response(body, { status: 200 })
  } catch (e) {
    console.error(e)
    return new Response(undefined, { status: 404 })
  }
}

afterEach(cleanup)

// jest.spyOn(global, 'fetch').mockImplementation(readBuffer)
beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(readBuffer)
})

describe('<JBrowse />', () => {
  it('renders with an empty config', async () => {
    const pluginManager = getPluginManager({})
    const { findByText } = render(<JBrowse pluginManager={pluginManager} />)
    expect(await findByText('Help')).toBeTruthy()
  })
  it('renders with an initialState', async () => {
    const pluginManager = getPluginManager()
    const { findByText } = render(<JBrowse pluginManager={pluginManager} />)
    expect(await findByText('Help')).toBeTruthy()
  })
})

describe('valid file tests', () => {
  beforeEach(() => {
    fetch.resetMocks()
    fetch.mockResponse(readBuffer)
  })
  it('access about menu', async () => {
    const pluginManager = getPluginManager()
    const { findByText } = render(<JBrowse pluginManager={pluginManager} />)

    fireEvent.click(await findByText('Help'))
    fireEvent.click(await findByText('About'))

    const dlg = await findByText(/The Evolutionary Software Foundation/)
    expect(dlg).toBeTruthy()
  })

  it('click and drag to move sideways', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId } = render(<JBrowse pluginManager={pluginManager} />)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))

    const start = state.session.views[0].offsetPx
    const track = await findByTestId('track-volvox_alignments')
    fireEvent.mouseDown(track, { clientX: 250, clientY: 20 })
    fireEvent.mouseMove(track, { clientX: 100, clientY: 20 })
    fireEvent.mouseUp(track, { clientX: 100, clientY: 20 })
    // wait for requestAnimationFrame
    await wait(() => {})
    const end = state.session.views[0].offsetPx
    expect(end - start).toEqual(150)
  })

  it('click and drag to rubberBand', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    const track = await findByTestId('rubberBand_controls')

    expect(state.session.views[0].bpPerPx).toEqual(0.05)
    fireEvent.mouseDown(track, { clientX: 100, clientY: 0 })
    fireEvent.mouseMove(track, { clientX: 250, clientY: 0 })
    fireEvent.mouseUp(track, { clientX: 250, clientY: 0 })
    const zoomMenuItem = await findByText('Zoom to region')
    fireEvent.click(zoomMenuItem)
    expect(state.session.views[0].bpPerPx).toEqual(0.02)
  })

  it('click and drag to reorder tracks', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId } = render(<JBrowse pluginManager={pluginManager} />)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))

    const trackId1 = state.session.views[0].tracks[1].id
    const dragHandle0 = await findByTestId(
      'dragHandle-integration_test-volvox_alignments',
    )
    const trackRenderingContainer1 = await findByTestId(
      'trackRenderingContainer-integration_test-volvox_filtered_vcf',
    )
    const dragStartEvent = createEvent.dragStart(dragHandle0)
    // Have to mock 'dataTransfer' because it's not supported in jsdom
    Object.defineProperty(dragStartEvent, 'dataTransfer', {
      value: { setDragImage: () => {} },
    })
    fireEvent.mouseDown(dragHandle0, { clientX: 10, clientY: 100 })
    fireEvent(dragHandle0, dragStartEvent)
    fireEvent.mouseMove(dragHandle0, { clientX: 10, clientY: 220 })
    fireEvent.dragEnter(trackRenderingContainer1)
    fireEvent.dragEnd(dragHandle0, { clientX: 10, clientY: 220 })
    fireEvent.mouseUp(dragHandle0, { clientX: 10, clientY: 220 })
    await wait(() => expect(state.session.views[0].tracks[0].id).toBe(trackId1))
  })

  it('click and zoom in and back out', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('ctgA')
    const before = state.session.views[0].bpPerPx
    fireEvent.click(await findByTestId('zoom_in'))
    await wait(() => {
      expect(state.session.views[0].bpPerPx).toBe(before / 2)
    })
    fireEvent.click(await findByTestId('zoom_out'))
    await wait(() => {
      expect(state.session.views[0].bpPerPx).toBe(before)
    })
    expect(state.session.views[0].bpPerPx).toEqual(before)
  }, 10000)

  it('opens track selector', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId } = render(<JBrowse pluginManager={pluginManager} />)

    await findByTestId('htsTrackEntry-volvox_alignments')
    expect(state.session.views[0].tracks.length).toBe(0)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
    expect(state.session.views[0].tracks.length).toBe(1)
  })

  it('opens reference sequence track and expects zoom in message', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { getAllByText, findByTestId } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_refseq'))
    state.session.views[0].setNewView(20, 0)
    await findByTestId('track-volvox_refseq')
    expect(getAllByText('Zoom in to see sequence')).toBeTruthy()
  })

  it('click to display center line with correct value', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, getByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )

    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
    await findByTestId('track-volvox_alignments')

    // opens the view menu and selects show center line
    const viewMenu = await findByTestId('view_menu_icon')
    fireEvent.click(viewMenu)
    await waitForElement(() => getByText('Show center line'))
    fireEvent.click(getByText('Show center line'))
    expect(state.session.views[0].showCenterLine).toBe(true)

    const { centerLineInfo } = state.session.views[0]
    expect(centerLineInfo.refName).toBe('ctgA')
    expect(centerLineInfo.offset).toEqual(120)
  })
})

describe('some error state', () => {
  it('test that BAI with 404 file displays error', async () => {
    console.error = jest.fn()
    const pluginManager = getPluginManager()
    const { findByTestId, findAllByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_alignments_bai_nonexist'),
    )
    await expect(findAllByText(/HTTP 404 fetching/)).resolves.toBeTruthy()

    expect(console.error).toHaveBeenCalled()
  })
})

describe('test renamed refs', () => {
  it('open a cram with alternate renamed ref', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_cram_alignments'))

    const canvas = await findAllByTestId('prerendered_canvas')

    const img = canvas[0].toDataURL()
    const data = img.replace(/^data:image\/\w+;base64,/, '')
    const buf = Buffer.from(data, 'base64')
    // this is needed to do a fuzzy image comparison because
    // the travis-ci was 2 pixels different for some reason, see PR #710
    expect(buf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  }, 10000 /* this test needs more time to run */)
  it('test that bam with contigA instead of ctgA displays', async () => {
    const pluginManager = getPluginManager()
    const { findByTestId, findAllByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_bam_altname'))
    await expect(
      findAllByText('ctgA_110_638_0:0:0_3:0:0_15b', {}, { timeout: 60000 }),
    ).resolves.toBeTruthy()
  }, 60000)

  it('open a bigwig with a renamed reference', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(5, 0)
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_microarray_density_altname'),
    )
    const canvas = await findAllByTestId('prerendered_canvas')
    const bigwigImg = canvas[0].toDataURL()
    const bigwigData = bigwigImg.replace(/^data:image\/\w+;base64,/, '')
    const bigwigBuf = Buffer.from(bigwigData, 'base64')
    expect(bigwigBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  })
})

describe('max height test', () => {
  it('test that bam with small max height displays message', async () => {
    const pluginManager = getPluginManager()
    const { findByTestId, findAllByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_bam_small_max_height'),
    )
    await findAllByText('Max height reached', {}, { timeout: 60000 })
  }, 60000)
})

test('lollipop track test', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(1, 150)
  fireEvent.click(await findByTestId('htsTrackEntry-lollipop_track'))

  await findByTestId('track-lollipop_track')
  await expect(findByTestId('three')).resolves.toBeTruthy()
})

test('variant track test - opens feature detail view', async () => {
  const pluginManager = getPluginManager()
  const state = pluginManager.rootModel
  const { findByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(0.05, 5000)
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))
  fireEvent.click(await findByTestId('test-vcf-604452'))

  // this text is to confirm a feature detail drawer opened
  expect(await findByTestId('variant-side-drawer')).toBeInTheDocument()
  fireEvent.click(await findByTestId('drawer-close'))
  fireEvent.contextMenu(await findByTestId('test-vcf-604452'))
  fireEvent.click(await findByText('Open feature details'))
  expect(await findByTestId('variant-side-drawer')).toBeInTheDocument()
}, 10000)

describe('nclist track test with long name', () => {
  it('see that a feature gets ellipses', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(1, -539)
    fireEvent.click(await findByTestId('htsTrackEntry-nclist_long_names'))
    await expect(
      findByText(
        'This is a gene with a very long name it is crazy abcdefghijklmnopqrstuvwxyz1...',
      ),
    ).resolves.toBeTruthy()
  })
})
describe('test configuration editor', () => {
  it('change color on track', async () => {
    const pluginManager = getPluginManager(undefined, true)
    const state = pluginManager.rootModel
    const { findByTestId, findByText, findByDisplayValue } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))
    fireEvent.click(
      await findByTestId('htsTrackEntryConfigure-volvox_filtered_vcf'),
    )
    await expect(findByTestId('configEditor')).resolves.toBeTruthy()
    const input = await findByDisplayValue('goldenrod')
    fireEvent.change(input, { target: { value: 'green' } })
    await wait(async () => {
      expect(await findByTestId('test-vcf-604452')).toHaveAttribute(
        'fill',
        'green',
      )
    })
  }, 10000)
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
    await findAllByText(/HTTP 404/, {}, { timeout: 5000 })
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
    await findAllByText(/HTTP 404/, {}, { timeout: 5000 })
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
    await findAllByText(/HTTP 404/, {}, { timeout: 5000 })
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
    await findAllByText(/HTTP 404/, {}, { timeout: 5000 })
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
    await findAllByText(/HTTP 404/, {}, { timeout: 5000 })
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

    // this is to confirm a alignment detail drawer widget opened
    await expect(findAllByTestId('alignment-side-drawer')).resolves.toBeTruthy()
  }, 15000)
  it('opens a SNPCoverageTrack', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText, findAllByTestId } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(5, 100)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_cram_snpcoverage'))

    const snpCoverageCanvas = await findAllByTestId('prerendered_canvas')
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
  }, 15000)

  it('opens a PileupTrack', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText, findAllByTestId } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(5, 100)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_cram_pileup'))

    const pileupCanvas = await findAllByTestId('prerendered_canvas')
    const pileupImg = pileupCanvas[0].toDataURL()
    const pileupData = pileupImg.replace(/^data:image\/\w+;base64,/, '')
    const pileupBuf = Buffer.from(pileupData, 'base64')
    expect(pileupBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  }, 15000)

  // Note: tracks with assembly volvox don't have much soft clipping
  it('opens the track menu and enables soft clipping', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findByText, getByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.5, 6000)

    // load track
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox-long-reads-sv-bam'),
    )
    await findByTestId('track-volvox-long-reads-sv-bam')
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
    expect(pileupBuf).toMatchImageSnapshot({
      failureThreshold: 0.2,
      failureThresholdType: 'percent',
    })
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
    await findByTestId('track-volvox-long-reads-cram')
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
    expect(buf).toMatchImageSnapshot()
  }, 10000)
})
describe('bigwig', () => {
  it('open a bigwig track', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(5, 0)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_microarray'))
    const canvas = await findAllByTestId('prerendered_canvas')
    const bigwigImg = canvas[0].toDataURL()
    const bigwigData = bigwigImg.replace(/^data:image\/\w+;base64,/, '')
    const bigwigBuf = Buffer.from(bigwigData, 'base64')
    expect(bigwigBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  })
  it('open a bigwig line track 2', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(10, 0)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_microarray_line'))
    const canvas = await findAllByTestId('prerendered_canvas')
    const bigwigImg = canvas[0].toDataURL()
    const bigwigData = bigwigImg.replace(/^data:image\/\w+;base64,/, '')
    const bigwigBuf = Buffer.from(bigwigData, 'base64')
    expect(bigwigBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  })
  it('open a bigwig density track', async () => {
    const pluginManager = getPluginManager()
    const state = pluginManager.rootModel
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(5, 0)
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_microarray_density'),
    )
    const canvas = await findAllByTestId('prerendered_canvas')
    const bigwigImg = canvas[0].toDataURL()
    const bigwigData = bigwigImg.replace(/^data:image\/\w+;base64,/, '')
    const bigwigBuf = Buffer.from(bigwigData, 'base64')
    expect(bigwigBuf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  })
})

describe('circular views', () => {
  it('open a circular view', async () => {
    console.warn = jest.fn()
    const configSnapshotWithCircular = JSON.parse(
      JSON.stringify(configSnapshot),
    )
    configSnapshotWithCircular.savedSessions[0] = {
      name: 'Integration Test Circular',
      views: [
        {
          id: 'integration_test_circular',
          type: 'CircularView',
        },
      ],
    }
    const pluginManager = getPluginManager(configSnapshotWithCircular)
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    // wait for the UI to be loaded
    await findByText('Help')

    fireEvent.click(await findByText('Open'))

    // open a track selector for the circular view
    const trackSelectButtons = await findAllByTestId('circular_track_select')
    expect(trackSelectButtons.length).toBe(1)
    fireEvent.click(trackSelectButtons[0])

    // wait for the track selector to open and then click the
    // checkbox for the chord test track to toggle it on
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_chord_test'))

    // expect the chord track to render eventually
    await expect(
      findByTestId('rpc-rendered-circular-chord-track'),
    ).resolves.toBeTruthy()
  })
})

xdescribe('breakpoint split view', () => {
  it('open a split view', async () => {
    console.warn = jest.fn()
    const pluginManager = getPluginManager(breakpointConfig)
    const { findByTestId, queryAllByTestId } = render(
      <JBrowse pluginManager={pluginManager} />,
    )
    await wait(() => {
      const r = queryAllByTestId('r1')
      expect(r.length).toBe(2)
    }) // the breakpoint could be partially loaded so explicitly wait for two items
    expect(
      await findByTestId('pacbio_hg002_breakpoints-loaded'),
    ).toMatchSnapshot()

    expect(await findByTestId('pacbio_vcf-loaded')).toMatchSnapshot()
  }, 10000)
})

// eslint-disable-next-line react/prop-types
function FallbackComponent({ error }) {
  return <div>there was an error: {String(error)}</div>
}

test('404 sequence file', async () => {
  console.error = jest.fn()
  const pluginManager = getPluginManager(chromeSizesConfig)
  const { findByText } = render(
    <ErrorBoundary FallbackComponent={FallbackComponent}>
      <JBrowse pluginManager={pluginManager} />
    </ErrorBoundary>,
  )
  expect(
    await findByText('HTTP 404 fetching test_data/grape.chrom.sizes.nonexist', {
      exact: false,
    }),
  ).toBeTruthy()
})

describe('dotplot view', () => {
  it('open a dotplot view', async () => {
    const pluginManager = getPluginManager(dotplotConfig)
    const { findByTestId } = render(<JBrowse pluginManager={pluginManager} />)

    const canvas = await findByTestId('prerendered_canvas')

    const img = canvas.toDataURL()
    const data = img.replace(/^data:image\/\w+;base64,/, '')
    const buf = Buffer.from(data, 'base64')
    // this is needed to do a fuzzy image comparison because
    // the travis-ci was 2 pixels different for some reason, see PR #710
    expect(buf).toMatchImageSnapshot({
      failureThreshold: 0.05,
      failureThresholdType: 'percent',
    })
  })
})
