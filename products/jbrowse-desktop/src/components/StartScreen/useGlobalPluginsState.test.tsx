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
const alsoAdded = { name: 'AlsoAdded', umdUrl: 'https://example.com/b.js' }

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

test('a failed write reports the error and goes back to what is on disk', async () => {
  // the default covers both the initial read and the re-read a failed write
  // triggers; only the write itself rejects
  mockInvoke.mockResolvedValue(existing)
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
  await waitFor(() => {
    expect(result.current.plugins).toEqual(existing)
  })
})

test('two edits in a row compose, rather than the second dropping the first', async () => {
  mockInvoke.mockResolvedValue(existing)
  const useGlobalPluginsState = await importHook()
  const { result } = renderHook(() => useGlobalPluginsState())
  await waitFor(() => {
    expect(result.current.plugins).toEqual(existing)
  })

  // a write that never resolves: the second click lands while the first is
  // still in flight, which is what clicking Install on two store cards does
  mockInvoke.mockReturnValue(new Promise(() => {}))
  act(() => {
    result.current.add(added)
  })
  act(() => {
    result.current.add(alsoAdded)
  })
  expect(result.current.plugins).toEqual([...existing, added, alsoAdded])
})

test('switching one off keeps its entry, so it can be switched back on', async () => {
  mockInvoke.mockResolvedValue(existing)
  const useGlobalPluginsState = await importHook()
  const { result } = renderHook(() => useGlobalPluginsState())
  await waitFor(() => {
    expect(result.current.plugins).toEqual(existing)
  })

  act(() => {
    result.current.setDisabled(0, true)
  })
  await waitFor(() => {
    expect(mockInvoke).toHaveBeenLastCalledWith('setGlobalPlugins', [
      { ...existing[0], disabled: true },
    ])
  })

  act(() => {
    result.current.setDisabled(0, false)
  })
  await waitFor(() => {
    expect(mockInvoke).toHaveBeenLastCalledWith('setGlobalPlugins', existing)
  })
})

test('a remove addresses the list on screen, not the one before the last edit', async () => {
  mockInvoke.mockResolvedValue(existing)
  const useGlobalPluginsState = await importHook()
  const { result } = renderHook(() => useGlobalPluginsState())
  await waitFor(() => {
    expect(result.current.plugins).toEqual(existing)
  })

  mockInvoke.mockReturnValue(new Promise(() => {}))
  act(() => {
    result.current.add(added)
  })
  act(() => {
    // index 1 is `added`, and only on the list the previous edit produced
    result.current.remove(1)
  })
  expect(result.current.plugins).toEqual(existing)
})
