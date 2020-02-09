import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  wait,
  waitForElement,
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
    return { status: 200, text: () => body, buffer: () => body }
  } catch (e) {
    console.error(e)
    return { status: 404, buffer: () => {} }
  }
}

afterEach(cleanup)

jest.spyOn(global, 'fetch').mockImplementation(readBuffer)

describe('<JBrowse />', () => {
  it('renders with an empty config', async () => {
    const { getByText } = render(<JBrowse configSnapshot={{}} />)
    expect(await waitForElement(() => getByText('Help'))).toBeTruthy()
  })
  it('renders with an initialState', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByText } = render(<JBrowse initialState={state} />)
    expect(await waitForElement(() => getByText('Help'))).toBeTruthy()
  })

  it('can use config from a url', async () => {
    const { getByText } = render(
      <JBrowse config={{ uri: 'test_data/config_integration_test.json' }} />,
    )
    expect(await waitForElement(() => getByText('Help'))).toBeTruthy()
  })

  it('can use config from a local file', async () => {
    const { getByText } = render(
      <JBrowse
        config={{
          localPath: require.resolve(
            '../test_data/config_integration_test.json',
          ),
        }}
      />,
    )
    expect(await waitForElement(() => getByText('Help'))).toBeTruthy()
  })
})

describe('valid file tests', () => {
  it('access about menu', async () => {
    const { getByText } = render(<JBrowse configSnapshot={config} />)
    await waitForElement(() => getByText('ctgA'))
    await waitForElement(() => getByText('Help'))
    fireEvent.click(getByText('Help'))
    fireEvent.click(getByText('About'))

    const dlg = await waitForElement(() =>
      getByText(/The Evolutionary Software Foundation/),
    )
    expect(dlg).toBeTruthy()
  })

  it('click and drag to move sideways', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId } = render(<JBrowse initialState={state} />)
    fireEvent.click(
      await waitForElement(() =>
        getByTestId('htsTrackEntry-volvox_alignments'),
      ),
    )

    const start = state.session.views[0].offsetPx
    const track = await waitForElement(() =>
      getByTestId('track-volvox_alignments'),
    )
    fireEvent.mouseDown(track, { clientX: 250, clientY: 20 })
    fireEvent.mouseMove(track, { clientX: 100, clientY: 20 })
    fireEvent.mouseUp(track, { clientX: 100, clientY: 20 })
    const end = state.session.views[0].offsetPx
    expect(end - start).toEqual(150)
  })

  it('click and drag to rubberband', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId } = render(<JBrowse initialState={state} />)
    const track = await waitForElement(() =>
      getByTestId('rubberband_container'),
    )

    expect(state.session.views[0].bpPerPx).toEqual(0.05)
    fireEvent.mouseDown(track, { clientX: 100, clientY: 0 })
    fireEvent.mouseMove(track, { clientX: 250, clientY: 0 })
    fireEvent.mouseUp(track, { clientX: 250, clientY: 0 })
    expect(state.session.views[0].bpPerPx).toEqual(0.02)
  })

  it('click and drag to reorder tracks', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId } = render(<JBrowse initialState={state} />)
    fireEvent.click(
      await waitForElement(() =>
        getByTestId('htsTrackEntry-volvox_alignments'),
      ),
    )
    fireEvent.click(
      await waitForElement(() =>
        getByTestId('htsTrackEntry-volvox_filtered_vcf'),
      ),
    )

    const trackId1 = state.session.views[0].tracks[1].id
    const dragHandle0 = await waitForElement(() =>
      getByTestId('dragHandle-integration_test-volvox_alignments'),
    )
    const trackControls1 = await waitForElement(() =>
      getByTestId('trackControls-integration_test-volvox_filtered_vcf'),
    )
    const dragStartEvent = createEvent.dragStart(dragHandle0)
    // Have to mock 'dataTransfer' because it's not supported in jsdom
    Object.defineProperty(dragStartEvent, 'dataTransfer', {
      value: { setDragImage: () => {} },
    })
    fireEvent.mouseDown(dragHandle0, { clientX: 10, clientY: 100 })
    fireEvent(dragHandle0, dragStartEvent)
    fireEvent.mouseMove(dragHandle0, { clientX: 10, clientY: 220 })
    fireEvent.dragEnter(trackControls1)
    fireEvent.dragEnd(dragHandle0, { clientX: 10, clientY: 220 })
    fireEvent.mouseUp(dragHandle0, { clientX: 10, clientY: 220 })
    await wait(() => expect(state.session.views[0].tracks[0].id).toBe(trackId1))
  })

  it('click and zoom in and back out', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId: byId } = render(<JBrowse initialState={state} />)
    const before = state.session.views[0].bpPerPx
    fireEvent.click(await waitForElement(() => byId('zoom_in')))
    fireEvent.click(await waitForElement(() => byId('zoom_out')))
    expect(state.session.views[0].bpPerPx).toEqual(before)
  })

  it('opens track selector', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId } = render(<JBrowse initialState={state} />)

    await waitForElement(() => getByTestId('htsTrackEntry-volvox_alignments'))
    expect(state.session.views[0].tracks.length).toBe(0)
    fireEvent.click(
      await waitForElement(() =>
        getByTestId('htsTrackEntry-volvox_alignments'),
      ),
    )
    expect(state.session.views[0].tracks.length).toBe(1)
  })

  it('opens reference sequence track and expects zoom in message', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getAllByText, getByTestId } = render(
      <JBrowse initialState={state} />,
    )
    fireEvent.click(
      await waitForElement(() => getByTestId('htsTrackEntry-volvox_refseq')),
    )
    state.session.views[0].setNewView(20, 0)
    await waitForElement(() => getByTestId('track-volvox_refseq'))
    expect(getAllByText('Zoom in to see sequence')).toBeTruthy()
  })
})

describe('some error state', () => {
  it('test that BAI with 404 file displays error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId, getAllByText } = render(
      <JBrowse initialState={state} />,
    )
    fireEvent.click(
      await waitForElement(() =>
        getByTestId('htsTrackEntry-volvox_alignments_bai_nonexist'),
      ),
    )
    await expect(
      waitForElement(() =>
        getAllByText(
          'HTTP 404 fetching test_data/volvox-sorted.bam.bai.nonexist',
        ),
      ),
    ).resolves.toBeTruthy()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('test renamed refs', () => {
  it('open a cram with alternate renamed ref', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId: byId, getAllByTestId, getByText } = render(
      <JBrowse initialState={state} />,
    )
    await waitForElement(() => getByText('Help'))
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(
      await waitForElement(() => byId('htsTrackEntry-volvox_cram_alignments')),
    )
    const canvas = await waitForElement(() =>
      getAllByTestId('prerendered_canvas'),
    )
    const img = canvas[0].toDataURL()
    const data = img.replace(/^data:image\/\w+;base64,/, '')
    const buf = Buffer.from(data, 'base64')
    // this is needed to do a fuzzy image comparison because
    // the travis-ci was 2 pixels different for some reason, see PR #710
    expect(buf).toMatchImageSnapshot({
      failureThreshold: 0.001,
      failureThresholdType: 'percent',
    })
  })
  it('test that bam with contigA instead of ctgA displays', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId, getAllByText } = render(
      <JBrowse initialState={state} />,
    )
    fireEvent.click(
      await waitForElement(() =>
        getByTestId('htsTrackEntry-volvox_bam_altname'),
      ),
    )
    await expect(
      waitForElement(() => getAllByText('ctgA_110_638_0:0:0_3:0:0_15b')),
    ).resolves.toBeTruthy()
  })

  it('open a bigwig with a renamed reference', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId: byId, getAllByTestId, getByText } = render(
      <JBrowse initialState={state} />,
    )
    await waitForElement(() => getByText('Help'))
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(
      await waitForElement(() =>
        byId('htsTrackEntry-volvox_microarray_density_altname'),
      ),
    )
    await expect(
      waitForElement(() => getAllByTestId('prerendered_canvas')),
    ).resolves.toBeTruthy()
  })
})

describe('max height test', () => {
  it('test that bam with small max height displays message', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId, getAllByText } = render(
      <JBrowse initialState={state} />,
    )
    fireEvent.click(
      await waitForElement(() =>
        getByTestId('htsTrackEntry-volvox_bam_small_max_height'),
      ),
    )
    await expect(
      waitForElement(() => getAllByText('Max height reached')),
    ).resolves.toBeTruthy()
  })
})

test('lollipop track test', async () => {
  const state = JBrowseRootModel.create({ jbrowse: config })
  const { getByTestId: byId, getByText } = render(
    <JBrowse initialState={state} />,
  )
  await waitForElement(() => getByText('Help'))
  state.session.views[0].setNewView(1, 150)
  fireEvent.click(
    await waitForElement(() => byId('htsTrackEntry-lollipop_track')),
  )

  await waitForElement(() => byId('track-lollipop_track'))
  await expect(waitForElement(() => byId('three'))).resolves.toBeTruthy()
})

test('variant track test - opens feature detail view', async () => {
  const state = JBrowseRootModel.create({ jbrowse: config })
  const { getByTestId: byId, getByText } = render(
    <JBrowse initialState={state} />,
  )
  await waitForElement(() => getByText('Help'))
  state.session.views[0].setNewView(0.05, 5000)
  fireEvent.click(
    await waitForElement(() => byId('htsTrackEntry-volvox_filtered_vcf')),
  )
  const ret = await waitForElement(() => byId('vcf-604452'))
  fireEvent.click(ret)
  await expect(
    waitForElement(() => getByText('ctgA:277..277')),
  ).resolves.toBeTruthy()
})

describe('nclist track test with long name', () => {
  it('see that a feature gets ellipses', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId: byId, getByText } = render(
      <JBrowse initialState={state} />,
    )
    await waitForElement(() => getByText('Help'))
    state.session.views[0].setNewView(1, -539)
    fireEvent.click(
      await waitForElement(() => byId('htsTrackEntry-nclist_long_names')),
    )
    await expect(
      waitForElement(() =>
        getByText(
          'This is a gene with a very long name it is crazy abcdefghijklmnopqrstuvwxyz1...',
        ),
      ),
    ).resolves.toBeTruthy()
  })
})
describe('test configuration editor', () => {
  it('change color on track', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const {
      getByTestId: byId,
      getByText,
      getByTitle,
      getByDisplayValue,
    } = render(<JBrowse initialState={state} />)
    await waitForElement(() => getByText('Help'))
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(
      await waitForElement(() => byId('htsTrackEntry-volvox_filtered_vcf')),
    )
    fireEvent.click(await waitForElement(() => getByTitle('configure track')))
    await expect(
      waitForElement(() => byId('configEditor')),
    ).resolves.toBeTruthy()
    const input = await waitForElement(() => getByDisplayValue('goldenrod'))
    fireEvent.change(input, { target: { value: 'green' } })
    await wait(async () => {
      expect(await waitForElement(() => byId('vcf-604452'))).toHaveAttribute(
        'fill',
        'green',
      )
    })
  }, 10000)
})

describe('bigwig', () => {
  it('open a bigwig track', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId: byId, getAllByTestId, getByText } = render(
      <JBrowse initialState={state} />,
    )
    await waitForElement(() => getByText('Help'))
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(
      await waitForElement(() => byId('htsTrackEntry-volvox_microarray')),
    )
    await expect(
      waitForElement(() => getAllByTestId('prerendered_canvas')),
    ).resolves.toBeTruthy()
  })
  it('open a bigwig line track', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId: byId, getAllByTestId, getByText } = render(
      <JBrowse initialState={state} />,
    )
    await waitForElement(() => getByText('Help'))
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(
      await waitForElement(() => byId('htsTrackEntry-volvox_microarray_line')),
    )
    await expect(
      waitForElement(() => getAllByTestId('prerendered_canvas')),
    ).resolves.toBeTruthy()
  })
  it('open a bigwig density track', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId: byId, getAllByTestId, getByText } = render(
      <JBrowse initialState={state} />,
    )
    await waitForElement(() => getByText('Help'))
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(
      await waitForElement(() =>
        byId('htsTrackEntry-volvox_microarray_density'),
      ),
    )
    await expect(
      waitForElement(() => getAllByTestId('prerendered_canvas')),
    ).resolves.toBeTruthy()
  })
})

describe('circular views', () => {
  it('open a circular view', async () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId, getByText, getAllByTestId } = render(
      <JBrowse initialState={state} />,
    )
    // wait for the UI to be loaded
    await waitForElement(() => getByText('Help'))

    // open a new circular view on the same assembly as the test linear view
    state.session.addViewFromAnotherView('CircularView', state.session.views[0])

    // open a track selector for the circular view
    const trackSelectButtons = await waitForElement(() =>
      getAllByTestId('circular_track_select'),
    )
    expect(trackSelectButtons.length).toBe(1)
    fireEvent.click(trackSelectButtons[0])

    // wait for the track selector to open and then click the
    // checkbox for the chord test track to toggle it on
    fireEvent.click(
      await waitForElement(() =>
        getByTestId('htsTrackEntry-volvox_chord_test'),
      ),
    )

    // expect the chord track to render eventually
    await expect(
      waitForElement(() => getByTestId('rpc-rendered-circular-chord-track')),
    ).resolves.toBeTruthy()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('breakpoint split view', () => {
  it('open a split view', async () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const state = JBrowseRootModel.create({ jbrowse: breakpointConfig })
    const { findByTestId } = render(<JBrowse initialState={state} />)

    expect(
      await findByTestId('pacbio_hg002_breakpoints-loaded', { timeout: 8000 }),
    ).toMatchSnapshot()

    expect(await findByTestId('pacbio_vcf-loaded')).toMatchSnapshot()
    spy.mockRestore()
  }, 10000)
})

test('cause an exception in the jbrowse module loading', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const { getByText } = render(
    <JBrowse configSnapshot={{ configuration: [] }} />,
  )
  expect(await getByText('Fatal error')).toBeTruthy()
  expect(spy).toHaveBeenCalled()
  spy.mockRestore()
})

test('404 sequence file', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const { findByText } = render(
    <JBrowse config={{ uri: 'test_data/config_chrom_sizes_test.json' }} />,
  )
  await findByText(/HTTP 404/)
  expect(spy).toHaveBeenCalled()
  spy.mockRestore()
})

describe('snpcoverage adapter tests', () => {
  it('test that SNPCoverage with CRAM displays (uses contigA instead of ctgA)', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId: byId, getAllByTestId, getByText } = render(
      <JBrowse initialState={state} />,
    )
    await waitForElement(() => getByText('Help'))
    state.session.views[0].setNewView(5, 100)
    fireEvent.click(
      await waitForElement(() => byId('htsTrackEntry-volvox_cram_SNP')),
    )
    const canvas = await waitForElement(() =>
      getAllByTestId('prerendered_canvas'),
    )

    const img = canvas[0].toDataURL()
    const data = img.replace(/^data:image\/\w+;base64,/, '')
    const buf = Buffer.from(data, 'base64')
    // this is needed to do a fuzzy image comparison because
    // the travis-ci was 2 pixels different for some reason, see PR #710
    expect(buf).toMatchImageSnapshot({
      failureThreshold: 0.5,
      failureThresholdType: 'percent',
    })
  })
  it('test that SNPCoverage with BAM displays (uses contigA instead of ctgA)', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId: byId, getAllByTestId, getByText } = render(
      <JBrowse initialState={state} />,
    )
    await waitForElement(() => getByText('Help'))
    state.session.views[0].setNewView(5, 100)
    fireEvent.click(
      await waitForElement(() => byId('htsTrackEntry-volvox_bam_altname_SNP')),
    )
    const canvas = await waitForElement(() =>
      getAllByTestId('prerendered_canvas'),
    )

    const img = canvas[0].toDataURL()
    const data = img.replace(/^data:image\/\w+;base64,/, '')
    const buf = Buffer.from(data, 'base64')
    // this is needed to do a fuzzy image comparison because
    // the travis-ci was 2 pixels different for some reason, see PR #710
    expect(buf).toMatchImageSnapshot({
      failureThreshold: 0.5,
      failureThresholdType: 'percent',
    })
  })
  it('SNPCoverage test that BAI with 404 file displays error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId: byId, getAllByText } = render(
      <JBrowse initialState={state} />,
    )
    fireEvent.click(
      await waitForElement(() =>
        byId('htsTrackEntry-volvox_alignments_bai_nonexist_SNP'),
      ),
    )
    await expect(
      waitForElement(() =>
        getAllByText(
          'HTTP 404 fetching test_data/volvox-sorted.bam.bai.nonexist',
        ),
      ),
    ).resolves.toBeTruthy()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
