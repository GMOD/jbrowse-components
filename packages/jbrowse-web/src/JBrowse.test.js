import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  wait,
  within,
} from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'
import React from 'react'
import { LocalFile } from 'generic-filehandle'
import rangeParser from 'range-parser'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import JBrowse from './JBrowse'
import config from '../test_data/config_integration_test.json'
import breakpointConfig from '../test_data/config_breakpoint_integration_test.json'
import JBrowseRootModel from './rootModel'

expect.extend({ toMatchImageSnapshot })

window.requestIdleCallback = cb => cb()
window.cancelIdleCallback = () => {}
window.requestAnimationFrame = cb => cb()
window.cancelAnimationFrame = () => {}

Storage.prototype.getItem = jest.fn(() => null)
Storage.prototype.setItem = jest.fn()
Storage.prototype.removeItem = jest.fn()
Storage.prototype.clear = jest.fn()

const getFile = url => new LocalFile(require.resolve(`../${url}`))
// fakes server responses from local file object with fetchMock
const readBuffer = async (url, args) => {
  try {
    const file = getFile(url)
    const maxRangeRequest = 1000000 // kind of arbitrary, part of the rangeParser
    if (args.headers.range) {
      const range = rangeParser(maxRangeRequest, args.headers.range)
      const { start, end } = range[0]
      const len = end - start + 1
      const buf = Buffer.alloc(len)
      const { bytesRead } = await file.read(buf, 0, len, start)
      const stat = await file.stat()
      return {
        status: 206,
        buffer: () => buf.slice(0, bytesRead),
        arrayBuffer: () => buf.slice(0, bytesRead),
        text: () => buf.slice(0, bytesRead),
        headers: new Map([['content-range', `${start}-${end}/${stat.size}`]]),
      }
    }
    const body = await file.readFile()
    return { status: 200, text: () => body.toString(), buffer: () => body }
  } catch (e) {
    console.error(e)
    return { status: 404, buffer: () => {} }
  }
}

afterEach(cleanup)

jest.spyOn(global, 'fetch').mockImplementation(readBuffer)

describe('<JBrowse />', () => {
  it('renders with an empty config', async () => {
    const { findByText } = render(<JBrowse configSnapshot={{}} />)
    expect(await findByText('Help')).toBeTruthy()
  })
  it('renders with an initialState', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByText } = render(<JBrowse initialState={state} />)
    expect(await findByText('Help')).toBeTruthy()
  })

  it('can use config from a url', async () => {
    const { findByText } = render(
      <JBrowse config={{ uri: 'test_data/config_integration_test.json' }} />,
    )
    expect(await findByText('Help')).toBeTruthy()
  })

  it('can use config from a local file', async () => {
    const { findByText } = render(
      <JBrowse
        config={{
          localPath: require.resolve(
            '../test_data/config_integration_test.json',
          ),
        }}
      />,
    )
    expect(await findByText('Help')).toBeTruthy()
  })
})

describe('valid file tests', () => {
  it('access about menu', async () => {
    const { findByText } = render(<JBrowse configSnapshot={config} />)

    fireEvent.click(await findByText('Help'))
    fireEvent.click(await findByText('About'))

    const dlg = await findByText(/The Evolutionary Software Foundation/)
    expect(dlg).toBeTruthy()
  })

  it('click and drag to move sideways', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId } = render(<JBrowse initialState={state} />)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))

    const start = state.session.views[0].offsetPx
    const track = await findByTestId('track-volvox_alignments')
    fireEvent.mouseDown(track, { clientX: 250, clientY: 20 })
    fireEvent.mouseMove(track, { clientX: 100, clientY: 20 })
    fireEvent.mouseUp(track, { clientX: 100, clientY: 20 })
    const end = state.session.views[0].offsetPx
    expect(end - start).toEqual(150)
  })

  it('click and drag to rubberBand', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId, findByText } = render(
      <JBrowse initialState={state} />,
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

  // TODO: write a right click integration test
  // TODO: write a centerline integration test
  // TODO: write a sorting test
  
  it('click and drag to reorder tracks', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId } = render(<JBrowse initialState={state} />)
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
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId, findByText } = render(
      <JBrowse initialState={state} />,
    )
    await findByText('ctgA')
    const before = state.session.views[0].bpPerPx
    fireEvent.click(await findByTestId('zoom_in'))
    fireEvent.click(await findByTestId('zoom_out'))
    expect(state.session.views[0].bpPerPx).toEqual(before)
  })

  it('opens track selector', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId } = render(<JBrowse initialState={state} />)

    await findByTestId('htsTrackEntry-volvox_alignments')
    expect(state.session.views[0].tracks.length).toBe(0)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_alignments'))
    expect(state.session.views[0].tracks.length).toBe(1)
  })

  it('opens reference sequence track and expects zoom in message', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getAllByText, findByTestId } = render(
      <JBrowse initialState={state} />,
    )
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_refseq'))
    state.session.views[0].setNewView(20, 0)
    await findByTestId('track-volvox_refseq')
    expect(getAllByText('Zoom in to see sequence')).toBeTruthy()
  })
})

describe('some error state', () => {
  it('test that BAI with 404 file displays error', async () => {
    console.error = jest.fn()
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId, findAllByText } = render(
      <JBrowse initialState={state} />,
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
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId, findByText } = render(
      <JBrowse initialState={state} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_cram_alignments'))

    const canvas = await findByTestId('prerendered_canvas')

    const img = canvas.toDataURL()
    const data = img.replace(/^data:image\/\w+;base64,/, '')
    const buf = Buffer.from(data, 'base64')
    // this is needed to do a fuzzy image comparison because
    // the travis-ci was 2 pixels different for some reason, see PR #710
    expect(buf).toMatchImageSnapshot({
      failureThreshold: 0.5,
      failureThresholdType: 'percent',
    })
  }, 10000 /* this test needs more time to run */)
  it('test that bam with contigA instead of ctgA displays', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId, findAllByText } = render(
      <JBrowse initialState={state} />,
    )
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_bam_altname'))
    await expect(
      findAllByText('ctgA_110_638_0:0:0_3:0:0_15b'),
    ).resolves.toBeTruthy()
  })

  it('open a bigwig with a renamed reference', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse initialState={state} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_microarray_density_altname'),
    )
    await expect(findAllByTestId('prerendered_canvas')).resolves.toBeTruthy()
  })
})

describe('max height test', () => {
  it('test that bam with small max height displays message', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId, findAllByText } = render(
      <JBrowse initialState={state} />,
    )
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_bam_small_max_height'),
    )
    await expect(findAllByText('Max height reached')).resolves.toBeTruthy()
  })
})

test('lollipop track test', async () => {
  const state = JBrowseRootModel.create({ jbrowse: config })
  const { findByTestId, findByText } = render(<JBrowse initialState={state} />)
  await findByText('Help')
  state.session.views[0].setNewView(1, 150)
  fireEvent.click(await findByTestId('htsTrackEntry-lollipop_track'))

  await findByTestId('track-lollipop_track')
  await expect(findByTestId('three')).resolves.toBeTruthy()
})

test('variant track test - opens feature detail view', async () => {
  const state = JBrowseRootModel.create({ jbrowse: config })
  const { findByTestId, findByText } = render(<JBrowse initialState={state} />)
  await findByText('Help')
  state.session.views[0].setNewView(0.05, 5000)
  fireEvent.click(await findByTestId('htsTrackEntry-volvox_filtered_vcf'))
  fireEvent.click(await findByTestId('test-vcf-604452'))
  await expect(findByText('ctgA:277..277')).resolves.toBeTruthy()
})

describe('nclist track test with long name', () => {
  it('see that a feature gets ellipses', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId, findByText } = render(
      <JBrowse initialState={state} />,
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
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId, findByText, findByDisplayValue } = render(
      <JBrowse initialState={state} />,
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
describe('alignments track', () => {
  // improve this, currently renders the pileup and stops
  // if pileup rendering is disabled then snp coverage will run
  it('opens an alignments track', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId, findByText } = render(
      <JBrowse initialState={state} />,
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
      failureThreshold: 0.5,
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
      failureThreshold: 0.5,
      failureThresholdType: 'percent',
    })
  }, 10000)
})
describe('bigwig', () => {
  it('open a bigwig track', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse initialState={state} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_microarray'))
    await expect(findAllByTestId('prerendered_canvas')).resolves.toBeTruthy()
  })
  it('open a bigwig line track', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse initialState={state} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(await findByTestId('htsTrackEntry-volvox_microarray_line'))
    await expect(findAllByTestId('prerendered_canvas')).resolves.toBeTruthy()
  })
  it('open a bigwig density track', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId, findAllByTestId, findByText } = render(
      <JBrowse initialState={state} />,
    )
    await findByText('Help')
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(
      await findByTestId('htsTrackEntry-volvox_microarray_density'),
    )
    await expect(findAllByTestId('prerendered_canvas')).resolves.toBeTruthy()
  })
})

describe('circular views', () => {
  it('open a circular view', async () => {
    console.warn = jest.fn()
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { findByTestId, findByText, findAllByTestId } = render(
      <JBrowse initialState={state} />,
    )
    // wait for the UI to be loaded
    await findByText('Help')

    // open a new circular view on the same assembly as the test linear view
    const regions = await state.session.getRegionsForAssemblyName('volvox')
    act(() => {
      const circularView = state.session.addView('CircularView')
      circularView.setDisplayedRegions(regions)
    })

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

describe('breakpoint split view', () => {
  it('open a split view', async () => {
    console.warn = jest.fn()
    const state = JBrowseRootModel.create({ jbrowse: breakpointConfig })
    const { findByTestId, queryAllByTestId } = render(
      <JBrowse initialState={state} />,
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

describe('Fatal error', () => {
  it('occurs when given an invalid snapshot', () => {
    const { getByText } = render(
      <JBrowse configSnapshot={{ configuration: [] }} />,
    )
    expect(getByText('Fatal error')).toBeTruthy()
  })
  it('occurs when multiple assemblies have the same name', async () => {
    const newConfig = JSON.parse(JSON.stringify(config))
    newConfig.assemblies.push({
      name: 'volvox',
      aliases: [],
    })
    const { findByText } = render(<JBrowse configSnapshot={newConfig} />)
    expect(
      await findByText('Found two assemblies with the same name: volvox', {
        exact: false,
      }),
    ).toBeTruthy()
  })
})

test('404 sequence file', async () => {
  console.error = jest.fn()
  const { findAllByText } = render(
    <JBrowse config={{ uri: 'test_data/config_chrom_sizes_test.json' }} />,
  )
  await findAllByText(/HTTP 404/)
})
