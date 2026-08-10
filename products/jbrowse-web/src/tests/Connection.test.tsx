import { fireEvent, screen, waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'

import configSnapshot from '../../test_data/volvox/config.json' with { type: 'json' }
import { handleRequest } from './generateReadBuffer.ts'
import { createView, doBeforeEach, generateReadBuffer } from './util.tsx'

beforeEach(() => {
  doBeforeEach()
})

const readBuffer = generateReadBuffer(
  s => new LocalFile(require.resolve(`../../test_data/volvox/${s}`)),
)

const delay = { timeout: 40000 }
const opts = [{}, delay]
const root = 'https://jbrowse.org/volvoxhub/'

test('Open up a UCSC trackhub connection', async () => {
  fetchMock.mockResponse(async request => {
    if (request.url.startsWith(root)) {
      const str = request.url.replace(root, '')
      return handleRequest(
        () =>
          new LocalFile(
            require.resolve(`../../test_data/volvoxhub/hub1/${str}`),
          ),
        request,
      )
    }
    return readBuffer(request)
  })

  const { findByText, findByTestId } = await createView(configSnapshot)

  fireEvent.click(await screen.findByText('File'))
  fireEvent.click(await screen.findByText('Open connection...'))

  const elt = await screen.findByText('Next', ...opts)
  await waitFor(() => {
    expect(elt).toHaveProperty('disabled', false)
  })
  fireEvent.click(elt)

  const input = await findByTestId('urlInput', ...opts)
  // one change event replaces the whole value, so the clear this replaced is
  // redundant rather than dropped
  fireEvent.change(input, { target: { value: `${root}hub.txt` } })

  const elt2 = await screen.findByText('Connect', ...opts)
  await waitFor(() => {
    expect(elt2).toHaveProperty('disabled', false)
  })
  fireEvent.click(elt2)

  await findByText('CRAM - Volvox Sorted', ...opts)
}, 40000)
