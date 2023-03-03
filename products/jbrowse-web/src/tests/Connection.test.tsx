import { fireEvent } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'

import { createView, generateReadBuffer, doBeforeEach } from './util'
jest.mock('../makeWorkerInstance', () => () => {})

beforeEach(() => {
  doBeforeEach()
})

const readBuffer = generateReadBuffer(
  url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
)

const readBuffer2 = generateReadBuffer(
  url =>
    new LocalFile(require.resolve(`../../test_data/volvoxhub/hub1/${url}`)),
)

const delay = 40000
const opts = [{}, delay]
const root = 'https://jbrowse.org/volvoxhub/'

test('Open up a UCSC trackhub connection', async () => {
  // @ts-expect-error
  fetch.mockResponse(async request => {
    if (request.url.startsWith(root)) {
      const str = request.url.replace(root, '')
      // @ts-expect-error
      return readBuffer2({ url: str, headers: new Map() })
    }
    return readBuffer(request)
  })

  const { findByTestId, findByText } = createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText(/Open connection/))
  fireEvent.click(await findByText('Next'))
  fireEvent.change(await findByTestId('urlInput'), {
    target: { value: 'https://jbrowse.org/volvoxhub/hub.txt' },
  })
  fireEvent.click(await findByText('Connect'))
  await findByText('CRAM - Volvox Sorted', ...opts)
}, 40000)
