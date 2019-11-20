import {
  cleanup,
  fireEvent,
  render,
  wait,
  waitForElement,
} from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'
import React from 'react'
import { LocalFile } from 'generic-filehandle'
import rangeParser from 'range-parser'
import { TextEncoder, TextDecoder } from 'text-encoding-polyfill'
import ErrorBoundary from 'react-error-boundary'
import JBrowse from './JBrowse'
import config from '../test_data/config_integration_test.json'
import breakpointConfig from '../test_data/config_breakpoint_integration_test.json'
import JBrowseRootModel from './rootModel'

window.requestIdleCallback = cb => cb()
window.cancelIdleCallback = () => {}
window.requestAnimationFrame = cb => cb()
window.cancelAnimationFrame = () => {}
window.TextEncoder = TextEncoder
window.TextDecoder = TextDecoder

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
      const len = end - start
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

// this is only here to make the error output not appear in the project's output
// even though in the course we don't include this bit and leave it in it's incomplete state.
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  console.error.mockRestore()
  console.warn.mockRestore()
})

describe('<JBrowse />', () => {
  it('renders with an empty config', async () => {
    const { getByText } = render(<JBrowse config={{}} />)
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
    const { getByText } = render(<JBrowse config={config} />)
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
  it('test that track with 404 file displays error', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId, getAllByText } = render(
      <JBrowse initialState={state} />,
    )
    fireEvent.click(
      await waitForElement(() =>
        getByTestId('htsTrackEntry-volvox_alignments_nonexist'),
      ),
    )
    await expect(
      waitForElement(() =>
        getAllByText(
          'HTTP 404 fetching test_data/volvox-sorted.bam.bai.nonexist',
        ),
      ),
    ).resolves.toBeTruthy()
    expect(console.error).toBeCalled()
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

describe('circular views', () => {
  it('open a circular view', async () => {
    const state = JBrowseRootModel.create({ jbrowse: config })
    const { getByTestId, getByText, getAllByTestId } = render(
      <JBrowse initialState={state} />,
    )
    // wait for the UI to be loaded
    await waitForElement(() => getByText('Help'))

    // open a new circular view on the same dataset as the test linear view
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
  })
})

describe('breakpoint split view', () => {
  it('open a split view', async () => {
    const state = JBrowseRootModel.create({ jbrowse: breakpointConfig })
    const { getByTestId, getByText } = render(<JBrowse initialState={state} />)
    await waitForElement(() => getByText('Help'))

    expect(
      await waitForElement(() =>
        getByTestId('pacbio_hg002_breakpoints-loaded'),
      ),
    ).toMatchSnapshot()

    expect(
      await waitForElement(() => getByTestId('pacbio_vcf-loaded')),
    ).toMatchSnapshot()
  })
})

test('cause an exception in the jbrowse module loading', async () => {
  const { getByText } = render(<JBrowse config={{ configuration: [] }} />)
  expect(await getByText('Fatal error')).toBeTruthy()
})
