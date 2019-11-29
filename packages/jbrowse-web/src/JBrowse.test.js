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
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
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
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

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
    expect(buf).toMatchImageSnapshot({
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    })
    // var buf = new Buffer(data, 'base64');
    // fs.writeFile('image.png', buf);

    /// / test that the output literally contains SNPs in the drawn canvas pileuprendering
    /// / because this ensures that the entire stack of things including refname renaming
    /// / works
    /// /
    /// / paste this data url in the browser for comparison and/or reference
    // expect(png).toEqual(
    //  'data:image/png;base64,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',
    // )
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
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
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
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('breakpoint split view', () => {
  it('open a split view', async () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
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
    spy.mockRestore()
  })
})

test('cause an exception in the jbrowse module loading', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const { getByText } = render(<JBrowse config={{ configuration: [] }} />)
  expect(await getByText('Fatal error')).toBeTruthy()
  expect(spy).toHaveBeenCalled()
  spy.mockRestore()
})
