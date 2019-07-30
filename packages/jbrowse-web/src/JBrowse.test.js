import {
  cleanup,
  fireEvent,
  render,
  waitForElement,
} from 'react-testing-library'
import React from 'react'
import fetchMock from 'fetch-mock'
import { LocalFile } from 'generic-filehandle'
import rangeParser from 'range-parser'
import JBrowse from './JBrowse'
import config from '../test_data/config_integration_test.json'
import jbrowseModel from './jbrowseModel'

fetchMock.config.sendAsJson = false
function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
window.requestIdleCallback = cb => cb()
window.cancelIdleCallback = () => {}

const getFile = url => new LocalFile(require.resolve(`../${url}`))
// fakes server responses from local file object with fetchMock
const readBuffer = async (url, args) => {
  let file
  try {
    file = getFile(url)
  } catch (e) {
    return { status: 404 }
  }
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
      body: buf.slice(0, bytesRead),
      headers: { 'Content-Range': `${start}-${end}/${stat.size}` },
    }
  }
  const body = await file.readFile()
  return { status: 200, body }
}

afterEach(cleanup)

fetchMock.mock('*', readBuffer)

// this is just a little hack to silence a warning that we'll get until react
// fixes this: https://github.com/facebook/react/pull/14853
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (/Warning.*not wrapped in act/.test(args[0])) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

describe('<JBrowse />', () => {
  it('renders with an empty config', async () => {
    const { getByText } = render(<JBrowse config={{}} />)
    expect(await waitForElement(() => getByText('JBrowse'))).toBeTruthy()
  })
  it('renders with an initialState', async () => {
    const state = jbrowseModel.create(config)
    const { getByText } = render(<JBrowse initialState={state} />)
    expect(await waitForElement(() => getByText('JBrowse'))).toBeTruthy()
  })

  it('can use config from a url', async () => {
    const { getByText } = render(
      <JBrowse config={{ uri: 'test_data/config_integration_test.json' }} />,
    )
    expect(await waitForElement(() => getByText('JBrowse'))).toBeTruthy()
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
    expect(await waitForElement(() => getByText('JBrowse'))).toBeTruthy()
  })
})

describe('valid file tests', () => {
  it('access about menu', async () => {
    const { getByText } = render(<JBrowse config={config} />)
    await waitForElement(() => getByText('ctgA'))
    await waitForElement(() => getByText('JBrowse'))
    fireEvent.click(getByText('Help'))
    fireEvent.click(getByText('About'))

    const dlg = await waitForElement(() => getByText(/About JBrowse/))
    expect(dlg).toBeTruthy()
  })

  it('click and drag to move sideways', async () => {
    const state = jbrowseModel.create(config)
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

  it('opens track selector', async () => {
    const state = jbrowseModel.create(config)
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
    const state = jbrowseModel.create(config)
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
    const state = jbrowseModel.create(config)
    const { getByTestId, getByText } = render(<JBrowse initialState={state} />)
    fireEvent.click(
      await waitForElement(() =>
        getByTestId('htsTrackEntry-volvox_alignments_nonexist'),
      ),
    )
    await expect(
      waitForElement(() =>
        getByText(
          'HTTP 404 fetching /test_data/volvox-sorted.bam.bai.nonexist',
        ),
      ),
    ).resolves.toBeTruthy()
  })
  it('test that bam with contigA instead of ctgA displays', async () => {
    const state = jbrowseModel.create(config)
    const { getByTestId, getByText } = render(<JBrowse initialState={state} />)
    fireEvent.click(
      await waitForElement(() =>
        getByTestId('htsTrackEntry-volvox_bam_altname'),
      ),
    )
    await expect(
      waitForElement(() => getByText('ctgA_110_638_0:0:0_3:0:0_15b')),
    ).resolves.toBeTruthy()
  })
  it('test that bam with small max height displays message', async () => {
    const state = jbrowseModel.create(config)
    const { getByTestId, getByText } = render(<JBrowse initialState={state} />)
    fireEvent.click(
      await waitForElement(() =>
        getByTestId('htsTrackEntry-volvox_bam_small_max_height'),
      ),
    )
    await expect(
      waitForElement(() => getByText('Max height reached')),
    ).resolves.toBeTruthy()
  })
  it('test that bam with contigA instead of ctgA displays', async () => {
    const state = jbrowseModel.create(config)
    const { getByTestId, getByText } = render(<JBrowse initialState={state} />)
    fireEvent.click(
      await waitForElement(() =>
        getByTestId('htsTrackEntry-volvox_bam_altname'),
      ),
    )
    await expect(
      waitForElement(() => getByText('ctgA_110_638_0:0:0_3:0:0_15b')),
    ).resolves.toBeTruthy()
  })
})

test('lollipop track test', async () => {
  const state = jbrowseModel.create(config)
  const { getByTestId: byId, getByText } = render(
    <JBrowse initialState={state} />,
  )
  await waitForElement(() => getByText('JBrowse'))
  state.session.views[0].setNewView(1, 150)
  fireEvent.click(
    await waitForElement(() => byId('htsTrackEntry-lollipop_track')),
  )

  await waitForElement(() => byId('track-lollipop_track'))
  await expect(waitForElement(() => byId('three'))).resolves.toBeTruthy()
})

test('variant track test - opens feature detail view', async () => {
  const state = jbrowseModel.create(config)
  const { getByTestId: byId, getByText } = render(
    <JBrowse initialState={state} />,
  )
  await waitForElement(() => getByText('JBrowse'))
  state.session.views[0].setNewView(0.05, 5000)
  fireEvent.click(
    await waitForElement(() => byId('htsTrackEntry-volvox_filtered_vcf')),
  )
  const ret = await waitForElement(() => byId('vcf-2560'))
  fireEvent.click(ret)
  await expect(
    waitForElement(() => getByText('ctgA:277..277')),
  ).resolves.toBeTruthy()
})

describe('nclist track test with long name', () => {
  it('see that a feature gets ellipses', async () => {
    const state = jbrowseModel.create(config)
    const { getByTestId: byId, getByText } = render(
      <JBrowse initialState={state} />,
    )
    await waitForElement(() => getByText('JBrowse'))
    state.session.views[0].setNewView(1, -539)
    fireEvent.click(
      await waitForElement(() => byId('htsTrackEntry-nclist_long_names')),
    )
    await expect(
      waitForElement(() =>
        getByText(
          'This is a gene with a very long name it is crazy abcdefghijklmnopqrstuvwxyz12345678...',
        ),
      ),
    ).resolves.toBeTruthy()
  })
})
describe('test configuration editor', () => {
  it('change color on track', async () => {
    const state = jbrowseModel.create(config)
    const {
      getByTestId: byId,
      getByText,
      getByTitle,
      getByDisplayValue,
    } = render(<JBrowse initialState={state} />)
    await waitForElement(() => getByText('JBrowse'))
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
    const ret = await waitForElement(() => byId('vcf-2560'))
    // TODO: remove timeout which waits for SSR re-render
    // Note: a series of like 5 or 6 waitForDomChange calls
    // on container also works instead of timeout
    await timeout(1000)
    expect(ret).toMatchSnapshot()
  })
})

describe('bigwig', () => {
  it('open a bigwig track', async () => {
    const state = jbrowseModel.create(config)
    const { getByTestId: byId, getByText } = render(
      <JBrowse initialState={state} />,
    )
    await waitForElement(() => getByText('JBrowse'))
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(
      await waitForElement(() => byId('htsTrackEntry-volvox_microarray')),
    )
    await expect(
      waitForElement(() => byId('prerendered_canvas')),
    ).resolves.toBeTruthy()
  })
  it('open a bigwig line track', async () => {
    const state = jbrowseModel.create(config)
    const { getByTestId: byId, getByText } = render(
      <JBrowse initialState={state} />,
    )
    await waitForElement(() => getByText('JBrowse'))
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(
      await waitForElement(() => byId('htsTrackEntry-volvox_microarray_line')),
    )
    await expect(
      waitForElement(() => byId('prerendered_canvas')),
    ).resolves.toBeTruthy()
  })
  it('open a bigwig density track', async () => {
    const state = jbrowseModel.create(config)
    const { getByTestId: byId, getByText } = render(
      <JBrowse initialState={state} />,
    )
    await waitForElement(() => getByText('JBrowse'))
    state.session.views[0].setNewView(0.05, 5000)
    fireEvent.click(
      await waitForElement(() =>
        byId('htsTrackEntry-volvox_microarray_density'),
      ),
    )
    await expect(
      waitForElement(() => byId('prerendered_canvas')),
    ).resolves.toBeTruthy()
  })
})
