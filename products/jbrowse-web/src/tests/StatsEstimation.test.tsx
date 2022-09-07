import { fireEvent, waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  setup,
  expectCanvasMatch,
  generateReadBuffer,
  createView,
  hts,
  pc,
} from './util'

setup()

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  // @ts-ignore
  fetch.resetMocks()
  // @ts-ignore
  fetch.mockResponse(
    generateReadBuffer(
      url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
    ),
  )
})

const delay = { timeout: 20000 }

test('test stats estimation pileup, zoom in to see', async () => {
  const { view, findByText, findAllByText, findByTestId } = createView()
  await findByText('Help')
  view.setNewView(30, 183)

  fireEvent.click(await findByTestId(hts('volvox_cram_pileup'), {}, delay))

  await findAllByText(/Requested too much data/, {}, delay)
  const before = view.bpPerPx
  fireEvent.click(await findByTestId('zoom_in'))
  // found it helps avoid flaky test to check that it is zoomed in before
  // checking snapshot (even though it seems like it is unneeded) #2673
  await waitFor(() => expect(view.bpPerPx).toBe(before / 2), delay)

  expectCanvasMatch(
    await findByTestId(pc('{volvox}ctgA:1..12,000-0'), {}, delay),
  )
}, 30000)

test('test stats estimation pileup, force load to see', async () => {
  const { view, findByText, findAllByText, findByTestId } = createView()
  await findByText('Help')
  view.setNewView(25.07852564102564, 283)

  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox_cram_pileup', {}, delay),
  )

  await findAllByText(/Requested too much data/, {}, delay)
  const buttons = await findAllByText(/Force Load/, {}, delay)
  fireEvent.click(buttons[0])

  expectCanvasMatch(
    await findByTestId(pc('{volvox}ctgA:1..20,063-0'), {}, delay),
  )
}, 30000)

test('test stats estimation on vcf track, zoom in to see', async () => {
  const { view, findByText, findAllByText, findAllByTestId, findByTestId } =
    createView()
  await findByText('Help')
  view.setNewView(34, 5)

  fireEvent.click(await findByTestId('htsTrackEntry-variant_colors', {}, delay))

  await findAllByText(/Zoom in to see features/, {}, delay)
  const before = view.bpPerPx
  fireEvent.click(await findByTestId('zoom_in'))
  // found it helps avoid flaky test to check that it is zoomed in before
  // checking snapshot (even though it seems like it is unneeded) #2673
  await waitFor(() => expect(view.bpPerPx).toBe(before / 2), delay)

  await findAllByTestId('box-test-vcf-605560', {}, delay)
}, 30000)

test('test stats estimation on vcf track, force load to see', async () => {
  const { view, findByText, findAllByText, findByTestId } = createView()
  await findByText('Help')
  view.setNewView(34, 5)
  await findAllByText('ctgA', {}, delay)

  fireEvent.click(await findByTestId('htsTrackEntry-variant_colors', {}, delay))

  await findAllByText(/Zoom in to see features/, {}, delay)
  const buttons = await findAllByText(/Force Load/, {}, delay)
  fireEvent.click(buttons[0])
  await findByTestId('box-test-vcf-605223', {}, delay)
}, 30000)
