import { act, renderHook, waitFor } from '@testing-library/react'

// The list is read and written through the same file, so a read that failed
// must never look like an empty list to the write path: the dialog would then
// save "[] plus whatever you just clicked" over everything the user had.

const mockInvoke = jest.fn()
jest.mock('electron', () => ({ ipcRenderer: { invoke: mockInvoke } }), {
  virtual: true,
})
Object.defineProperty(window, 'require', {
  value: () => ({ ipcRenderer: { invoke: mockInvoke } }),
  writable: true,
})

// imported dynamically: globalPlugins.ts destructures window.require('electron')
// at module scope, which a hoisted static import would run before the stub above
async function importHook() {
  const { useGlobalPluginsState } = await import('./useGlobalPluginsState.ts')
  return useGlobalPluginsState
}

const existing = [{ name: 'Existing', umdUrl: 'https://example.com/e.js' }]
const added = { name: 'Added', umdUrl: 'https://example.com/a.js' }

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

test('an add is written on top of the list that was read', async () => {
  mockInvoke.mockResolvedValue(existing)
  const useGlobalPluginsState = await importHook()
  const { result } = renderHook(() => useGlobalPluginsState())
  await waitFor(() => {
    expect(result.current.plugins).toEqual(existing)
  })

  mockInvoke.mockResolvedValue(undefined)
  act(() => {
    result.current.add(added)
  })
  await waitFor(() => {
    expect(result.current.plugins).toEqual([...existing, added])
  })
  expect(mockInvoke).toHaveBeenLastCalledWith('setGlobalPlugins', [
    ...existing,
    added,
  ])
})

test('a failed read leaves the list unknown and writes nothing', async () => {
  mockInvoke.mockRejectedValue(new Error('EACCES'))
  const useGlobalPluginsState = await importHook()
  const { result } = renderHook(() => useGlobalPluginsState())
  await waitFor(() => {
    expect(result.current.loadError).toBeDefined()
  })
  expect(result.current.plugins).toBeUndefined()

  act(() => {
    result.current.add(added)
  })
  expect(mockInvoke).not.toHaveBeenCalledWith(
    'setGlobalPlugins',
    expect.anything(),
  )
})

test('a failed write reports the error and keeps showing what is on disk', async () => {
  mockInvoke.mockResolvedValueOnce(existing)
  const useGlobalPluginsState = await importHook()
  const { result } = renderHook(() => useGlobalPluginsState())
  await waitFor(() => {
    expect(result.current.plugins).toEqual(existing)
  })

  mockInvoke.mockRejectedValueOnce(new Error('ENOSPC'))
  act(() => {
    result.current.add(added)
  })
  await waitFor(() => {
    expect(result.current.saveError).toBeDefined()
  })
  expect(result.current.plugins).toEqual(existing)
})
