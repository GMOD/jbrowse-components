import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocalFile } from 'generic-filehandle'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { createView, doBeforeEach, generateReadBuffer, setup } from './util'
import configSnapshot from '../../test_data/volvox/config.json'
setup()
afterEach(() => {
  cleanup()
})

beforeEach(() => {
  doBeforeEach()
})

const readBuffer = generateReadBuffer(
  s => new LocalFile(require.resolve(`../../test_data/volvox/${s}`)),
)

const readBuffer2 = generateReadBuffer(
  s => new LocalFile(require.resolve(`../../test_data/volvoxhub/hub1/${s}`)),
)

const delay = { timeout: 40000 }
const opts = [{}, delay]
const root = 'https://jbrowse.org/volvoxhub/'

test('Open up a UCSC trackhub connection', async () => {
  global.fetch = vi.fn().mockImplementation(url => {
    return url.startsWith(root)
      ? readBuffer2(url.replace(root, ''))
      : readBuffer(url)
  })
  const user = userEvent.setup()

  const { findByText, findByTestId } = await createView(configSnapshot)

  await user.click(await screen.findByText('File'))
  await user.click(await screen.findByText('Open connection...'))

  const elt = await screen.findByText('Next', ...opts)
  await waitFor(() => {
    expect(elt).toHaveProperty('disabled', false)
  })
  await user.click(elt)

  const input = await findByTestId('urlInput', ...opts)
  await user.clear(input)
  await user.type(input, `${root}hub.txt`)

  const elt2 = await screen.findByText('Connect', ...opts)
  await waitFor(() => {
    expect(elt2).toHaveProperty('disabled', false)
  })
  await user.click(elt2)

  await findByText('CRAM - Volvox Sorted', ...opts)
}, 40000)
