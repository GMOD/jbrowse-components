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
import config from '../test_data/alignments_test.json'

fetchMock.config.sendAsJson = false

jest.mock('request-idle-callback', () => ({
  requestIdleCallback: callback => callback(),
  cancelIdleCallback: () => {},
}))

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

describe('valid file tests', () => {
  it('access about menu', async () => {
    const { getByText } = render(<JBrowse configs={[config]} />)
    await waitForElement(() => getByText('JBrowse'))
    fireEvent.click(getByText('Help'))
    fireEvent.click(getByText('About'))

    const dlg = await waitForElement(() => getByText(/About JBrowse/))
    expect(dlg).toBeTruthy()
  })

  it('click and drag to move sideways', async () => {
    const { getByTestId } = render(<JBrowse configs={[config]} />)
    fireEvent.click(
      await waitForElement(() => getByTestId('volvox_alignments')),
    )
    const start = window.MODEL.views[0].offsetPx
    const track = await waitForElement(() =>
      getByTestId('track-volvox_alignments'),
    )
    fireEvent.mouseDown(track, { clientX: 250, clientY: 20 })
    fireEvent.mouseMove(track, { clientX: 100, clientY: 20 })
    fireEvent.mouseUp(track, { clientX: 100, clientY: 20 })
    const end = window.MODEL.views[0].offsetPx
    expect(end - start).toEqual(150)
  })

  it('opens track selector', async () => {
    const { getByTestId } = render(<JBrowse configs={[config]} />)

    await waitForElement(() => getByTestId('volvox_alignments'))
    expect(window.MODEL.views[0].tracks.length).toBe(0)
    fireEvent.click(
      await waitForElement(() => getByTestId('volvox_alignments')),
    )
    expect(window.MODEL.views[0].tracks.length).toBe(1)
  })

  it('opens reference sequence track and expects zoom in message', async () => {
    const { getByTestId, getByText } = render(<JBrowse configs={[config]} />)
    fireEvent.click(await waitForElement(() => getByTestId('volvox_refseq')))
    window.MODEL.views[0].setNewView(20, 0)
    await waitForElement(() => getByTestId('track-volvox_refseq'))
    expect(getByText('Zoom in to see sequence')).toBeTruthy()
  })
})

describe('some error state', () => {
  it('test that track with 404 file displays error', async () => {
    const { getByTestId, getByText } = render(<JBrowse configs={[config]} />)
    fireEvent.click(
      await waitForElement(() => getByTestId('volvox_alignments_nonexist')),
    )
    expect(
      await waitForElement(() =>
        getByText(
          'HTTP 404 fetching /test_data/volvox-sorted.bam.bai.nonexist',
        ),
      ),
    ).toBeTruthy()
  })
})

describe('variant', () => {
  it('click on a vcf feature', async () => {
    const { getByTestId: byId, getByText } = render(
      <JBrowse configs={[config]} />,
    )
    await waitForElement(() => getByText('JBrowse'))
    window.MODEL.views[0].setNewView(0.05, 5000)
    fireEvent.click(await waitForElement(() => byId('volvox_filtered_vcf')))
    fireEvent.click(await waitForElement(() => byId('vcf-2560')))
    expect(await waitForElement(() => getByText('ctgA:277..277'))).toBeTruthy()
  })
})

describe('bigwig', () => {
  it('open a bigwig track', async () => {
    const { getByTestId: byId, getByText } = render(
      <JBrowse configs={[config]} />,
    )
    await waitForElement(() => getByText('JBrowse'))
    window.MODEL.views[0].setNewView(0.05, 5000)
    fireEvent.click(await waitForElement(() => byId('volvox_microarray')))
    await waitForElement(() => byId('prerendered_canvas'))
  })
  it('open a bigwig line track', async () => {
    const { getByTestId: byId, getByText } = render(
      <JBrowse configs={[config]} />,
    )
    await waitForElement(() => getByText('JBrowse'))
    window.MODEL.views[0].setNewView(0.05, 5000)
    fireEvent.click(await waitForElement(() => byId('volvox_microarray_line')))
    await waitForElement(() => byId('prerendered_canvas'))
  })
  it('open a bigwig density track', async () => {
    const { getByTestId: byId, getByText } = render(
      <JBrowse configs={[config]} />,
    )
    await waitForElement(() => getByText('JBrowse'))
    window.MODEL.views[0].setNewView(0.05, 5000)
    fireEvent.click(
      await waitForElement(() => byId('volvox_microarray_density')),
    )
    await waitForElement(() => byId('prerendered_canvas'))
  })
})
