import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render, waitForElementToBeRemoved } from '@testing-library/react'

import RefNameInfoDialog from './RefNameInfoDialog.tsx'

import type { AbstractSessionModel } from '@jbrowse/core/util'

interface CallArgs {
  assemblyName: string
}
type Call = (a: unknown, b: unknown, args: CallArgs) => Promise<unknown>

function makeSession(call: Call) {
  return { rpcManager: { call } } as unknown as AbstractSessionModel
}

function renderDialog(assemblyNames: string[], call: Call) {
  const config = {
    trackId: 'track1',
    assemblyNames,
    adapter: { type: 'TestAdapter' },
  }
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <RefNameInfoDialog
        config={config}
        session={makeSession(call)}
        onClose={() => {}}
      />
    </ThemeProvider>,
  )
}

test('renders ref names grouped by assembly', async () => {
  const { findByText, queryByText } = renderDialog(['volvox'], async () => [
    'ctgA',
    'ctgB',
  ])
  await waitForElementToBeRemoved(() => queryByText('Loading refNames'))
  expect(await findByText(/--- volvox ---/)).toBeTruthy()
  expect(await findByText(/ctgA/)).toBeTruthy()
})

test('dedups repeated assembly names into a single fetch', async () => {
  const call = jest.fn<Promise<unknown>, [unknown, unknown, CallArgs]>(
    async () => ['ctgA'],
  )
  const { findByText } = renderDialog(['volvox', 'volvox'], call)
  await findByText(/ctgA/)
  expect(call.mock.calls.length).toBe(1)
})

test('truncates long ref name lists with a copy hint', async () => {
  const names = Array.from({ length: 10_001 }, (_, i) => `ctg${i}`)
  const { findByText } = renderDialog(['big'], async () => names)
  expect(await findByText(/Too many refNames to show/)).toBeTruthy()
})

test('shows an error banner when the rpc rejects', async () => {
  const { findByText } = renderDialog(['volvox'], () =>
    Promise.reject(new Error('refnames boom')),
  )
  expect(await findByText(/refnames boom/)).toBeTruthy()
})
