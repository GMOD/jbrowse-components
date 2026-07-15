import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render, waitForElementToBeRemoved } from '@testing-library/react'

import FileInfoPanel from './FileInfoPanel.tsx'

import type { AbstractSessionModel } from '@jbrowse/core/util'

const config = { trackId: 'track1', adapter: { type: 'TestAdapter' } }

function makeSession(call: (...args: unknown[]) => Promise<unknown>) {
  return { rpcManager: { call } } as unknown as AbstractSessionModel
}

function renderPanel(call: (...args: unknown[]) => Promise<unknown>) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <FileInfoPanel config={config} session={makeSession(call)} />
    </ThemeProvider>,
  )
}

test('stops loading when the adapter resolves to undefined', async () => {
  // regression: undefined was indistinguishable from in-flight, so the panel
  // would spin forever. isLoading settles regardless of the resolved value.
  const { getByText, queryByText } = renderPanel(() =>
    Promise.resolve(undefined),
  )
  expect(getByText('Loading file data')).toBeTruthy()
  await waitForElementToBeRemoved(() => queryByText('Loading file data'))
})

test('renders object file info', async () => {
  const { findByText } = renderPanel(() =>
    Promise.resolve({ SQ: 'distinctiveheadervalue' }),
  )
  expect(await findByText(/distinctiveheadervalue/)).toBeTruthy()
})

test('renders string file info as preformatted, escaping html', async () => {
  const { findByText } = renderPanel(() =>
    Promise.resolve('@HD\tVN:1.6 <unsafe>'),
  )
  expect(await findByText(/VN:1.6 <unsafe>/)).toBeTruthy()
})

test('shows an error banner when the rpc rejects', async () => {
  const { findByText } = renderPanel(() =>
    Promise.reject(new Error('rpc exploded')),
  )
  expect(await findByText(/rpc exploded/)).toBeTruthy()
})
