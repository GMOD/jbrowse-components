import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import GlobalPluginsDialog from './GlobalPluginsDialog.tsx'

const mockInvoke = jest.fn()
jest.mock('../../ipc.ts', () => ({
  invokeIpc: (...args: unknown[]) => mockInvoke(...args),
}))
// the real one fetches jbrowse.org's manifest; the available-plugins half of the
// dialog is PluginStoreCard's, tested where it lives
jest.mock('@jbrowse/core/util/useFetchPlugins', () => ({
  useFetchPlugins: () => ({ plugins: [], error: undefined }),
}))

const alpha = { name: 'Alpha', umdUrl: 'https://example.com/alpha.js' }
const beta = { name: 'Beta', umdUrl: 'https://example.com/beta.js' }
const gamma = { name: 'Gamma', umdUrl: 'https://example.com/gamma.js' }

beforeEach(() => {
  jest.resetAllMocks()
})

function lastWrite() {
  return mockInvoke.mock.calls.findLast(c => c[0] === 'setGlobalPlugins')?.[1]
}

async function open(list: unknown[]) {
  mockInvoke.mockResolvedValue(list)
  render(<GlobalPluginsDialog onClose={() => {}} />)
  await screen.findByText(/Installed global plugins/)
}

// Every control in the installed list addresses a plugin by its position in the
// stored list, while the rows on screen are a *filtered* view of it. Mapping to
// positions before filtering is what keeps those the same thing; doing it the
// other way round removes a different plugin than the one whose row was clicked,
// and says nothing about it either way.
test('a click acts on the row it is on, not the row at that position on screen', async () => {
  await open([alpha, beta, gamma])
  fireEvent.change(screen.getByLabelText('Filter plugins'), {
    target: { value: 'gamma' },
  })

  // the only row left is the third entry, at screen position 0
  fireEvent.click(screen.getByRole('button', { name: 'Remove global plugin' }))

  await waitFor(() => {
    expect(lastWrite()).toEqual([alpha, beta])
  })
})

test('the switch disables the row it is on, keeping the entry', async () => {
  await open([alpha, beta])
  fireEvent.click(screen.getByRole('switch', { name: /Enable Beta/ }))

  await waitFor(() => {
    expect(lastWrite()).toEqual([alpha, { ...beta, disabled: true }])
  })
})

test('a disabled row says so, and its switch turns it back on', async () => {
  await open([{ ...alpha, disabled: true }])
  expect(screen.getByText(/disabled/)).toBeTruthy()

  const toggle = screen.getByRole('switch', { name: /Enable Alpha/ })
  expect((toggle as HTMLInputElement).checked).toBe(false)
  fireEvent.click(toggle)

  await waitFor(() => {
    // back to exactly the entry that was there before, flag and all
    expect(lastWrite()).toEqual([alpha])
  })
})

// A list that cannot be read leaves nothing to edit, so every control above is
// hidden. Without this one the dialog is a dead end and the only way out of a
// corrupt globalPlugins.json is a factory reset, which also costs the user every
// session they have.
test('offers a way out when the list cannot be read at all', async () => {
  mockInvoke.mockRejectedValue(new Error('EACCES'))
  jest.spyOn(console, 'error').mockImplementation(() => {})
  render(<GlobalPluginsDialog onClose={() => {}} />)

  const reset = await screen.findByRole('button', {
    name: /Reset the global plugin list/,
  })
  expect(screen.queryByText(/Installed global plugins/)).toBeNull()

  mockInvoke.mockResolvedValue(undefined)
  fireEvent.click(reset)

  await waitFor(() => {
    expect(lastWrite()).toEqual([])
  })
  // and the dialog becomes usable again rather than staying on the error
  await screen.findByText(/Installed global plugins/)
})
