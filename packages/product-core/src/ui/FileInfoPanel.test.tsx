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

// BaseFeatureDataAdapter.getHeader returns null unless an adapter overrides it,
// and CoreGetInfo returns null for anything that isn't a feature adapter — so
// most tracks got a FILE INFO heading with blank space under it
test.each([[null], [undefined], [{}], [{ a: null }]])(
  'renders nothing at all when the adapter has no info (%p)',
  async info => {
    const { queryByText } = renderPanel(() => Promise.resolve(info))
    await waitForElementToBeRemoved(() => queryByText('Loading file data'))
    expect(queryByText('File info')).toBeNull()
  },
)

test('keeps the card for a falsy-but-present value', async () => {
  const { findByText } = renderPanel(() => Promise.resolve({ count: 0 }))
  expect(await findByText('File info')).toBeTruthy()
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
