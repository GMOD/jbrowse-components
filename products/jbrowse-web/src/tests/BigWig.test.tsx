import { fireEvent } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'

import {
  setup,
  generateReadBuffer,
  expectCanvasMatch,
  createView,
  pc,
  hts,
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

const delay = { timeout: 10000 }

test('open a bigwig track', async () => {
  const { view, findByTestId, findByText } = createView()
  await findByText('Help')
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray'), {}, delay))
  expectCanvasMatch(
    await findByTestId(pc('{volvox}ctgA:1..4,000-0'), {}, delay),
  )
}, 15000)
test('open a bigwig line track 2', async () => {
  const { view, findByTestId, findByText } = createView()

  await findByText('Help')
  view.setNewView(10, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray_line'), {}, delay))
  expectCanvasMatch(
    await findByTestId(pc('{volvox}ctgA:1..8,000-0'), {}, delay),
  )
}, 15000)
test('open a bigwig density track', async () => {
  const { view, findByTestId, findByText } = createView()

  await findByText('Help')
  view.setNewView(5, 0)
  fireEvent.click(
    await findByTestId(hts('volvox_microarray_density'), {}, delay),
  )
  expectCanvasMatch(
    await findByTestId(pc('{volvox}ctgA:1..4,000-0'), {}, delay),
  )
}, 15000)
