import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { destroy, types } from '@jbrowse/mobx-state-tree'
import { act, renderHook } from '@testing-library/react'

import { useClusterRun } from './useClusterRun.ts'

import type { RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

type Run = (args: {
  stopToken: StopToken
  statusCallback: (arg: RpcStatus) => void
}) => Promise<void>

// A run the test opens by hand, so a stop/unmount can land while it is still
// in flight.
function gate() {
  const holder = { open: () => {} }
  const opened = new Promise<void>(resolve => {
    holder.open = resolve
  })
  return {
    opened,
    open: () => {
      holder.open()
    },
  }
}

function setup(run: Run) {
  const onSuccess = jest.fn()
  const model = types.model('Display', {}).create()
  const view = renderHook(() => useClusterRun({ model, onSuccess, run }))
  return { ...view, onSuccess, model }
}

let consoleErrorSpy: jest.SpyInstance

beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('useClusterRun', () => {
  it('reports the run status and hands the result to onSuccess', async () => {
    const g = gate()
    const { result, onSuccess } = setup(async ({ statusCallback }) => {
      statusCallback({ message: 'Clustering samples', current: 1, total: 4 })
      await g.opened
    })

    let running: Promise<void> | undefined
    act(() => {
      running = result.current.run()
    })
    expect(result.current.loading).toBe(true)
    expect(result.current.status).toEqual({
      message: 'Clustering samples',
      current: 1,
      total: 4,
    })

    g.open()
    await act(async () => {
      await running
    })

    expect(onSuccess).toHaveBeenCalled()
    // back to idle on success too, not only on failure — the hook doesn't assume
    // onSuccess unmounted it
    expect(result.current.loading).toBe(false)
    expect(result.current.status).toBeUndefined()
  })

  it('surfaces a failure and puts the dialog back to idle', async () => {
    const { result, onSuccess } = setup(() =>
      Promise.reject(new Error('rpc exploded')),
    )

    await act(async () => {
      await result.current.run()
    })

    expect(onSuccess).not.toHaveBeenCalled()
    expect(result.current.error).toEqual(new Error('rpc exploded'))
    expect(result.current.loading).toBe(false)
    expect(result.current.status).toBeUndefined()
  })

  it('treats a thrown precondition like any other failure', async () => {
    const { result } = setup(() => {
      throw new Error('The view is not initialized yet')
    })

    await act(async () => {
      await result.current.run()
    })

    expect(result.current.error).toEqual(
      new Error('The view is not initialized yet'),
    )
  })

  it('stops the token the run is holding, and reports no error for it', async () => {
    const g = gate()
    const { result } = setup(async ({ stopToken }) => {
      await g.opened
      checkStopToken(stopToken)
    })

    let running: Promise<void> | undefined
    act(() => {
      running = result.current.run()
    })
    expect(result.current.loading).toBe(true)

    act(() => {
      result.current.stop()
    })
    g.open()
    await act(async () => {
      await running
    })

    // stopping is the user's own doing, so it lands back at idle with nothing
    // to report
    expect(result.current.error).toBeUndefined()
    expect(result.current.loading).toBe(false)
  })

  it('stops the token when the dialog goes away mid-run', async () => {
    const g = gate()
    const seen: StopToken[] = []
    const { result, unmount } = setup(async ({ stopToken }) => {
      seen.push(stopToken)
      await g.opened
      checkStopToken(stopToken)
    })

    let running: Promise<void> | undefined
    act(() => {
      running = result.current.run()
    })
    unmount()
    g.open()

    await expect(running).resolves.toBeUndefined()
    expect(() => {
      checkStopToken(seen[0])
    }).toThrow(/aborted/)
  })

  it('says nothing when the run fails after its display was removed', async () => {
    const g = gate()
    const { result, model } = setup(async () => {
      await g.opened
      throw new Error('rpc exploded')
    })

    let running: Promise<void> | undefined
    act(() => {
      running = result.current.run()
    })
    destroy(model)
    g.open()
    await act(async () => {
      await running
    })

    expect(result.current.error).toBeUndefined()
  })
})
