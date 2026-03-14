import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'

interface LifecycleModel {
  isLoading: boolean
  error: unknown
  renderingStopToken: string | undefined
  fetchGeneration: number
  regionTooLargeState: boolean
  regionTooLargeReasonState: string
  statusMessage: string | undefined
}

interface FetchContext {
  stopToken: string
  generation: number
  isStale: () => boolean
}

function createModel(): LifecycleModel {
  return {
    isLoading: false,
    error: undefined,
    renderingStopToken: undefined,
    fetchGeneration: 0,
    regionTooLargeState: false,
    regionTooLargeReasonState: '',
    statusMessage: undefined,
  }
}

function withFetchLifecycle(
  model: LifecycleModel,
  byteEstimate: (() => Promise<{
    tooLarge: boolean
    reason?: string
  } | null>) | null,
  work: (ctx: FetchContext) => Promise<void>,
) {
  if (model.renderingStopToken) {
    stopStopToken(model.renderingStopToken)
  }
  const stopToken = createStopToken()
  const generation = model.fetchGeneration
  model.renderingStopToken = stopToken
  model.isLoading = true
  model.error = undefined

  const isStale = () =>
    model.fetchGeneration !== generation ||
    model.renderingStopToken !== stopToken

  const ctx: FetchContext = { stopToken, generation, isStale }

  return (async () => {
    try {
      if (byteEstimate) {
        const result = await byteEstimate()
        if (isStale()) {
          return
        }
        if (result) {
          if (result.tooLarge) {
            model.regionTooLargeState = true
            model.regionTooLargeReasonState = result.reason ?? ''
            model.renderingStopToken = undefined
            model.isLoading = false
            model.statusMessage = undefined
            return
          }
        }
      }
      model.regionTooLargeState = false
      await work(ctx)
    } catch (e) {
      if (!isStale()) {
        model.error = e
      }
    } finally {
      if (!isStale()) {
        model.renderingStopToken = undefined
        model.isLoading = false
        model.statusMessage = undefined
      }
    }
  })()
}

function clearAllRpcData(model: LifecycleModel) {
  if (model.renderingStopToken) {
    stopStopToken(model.renderingStopToken)
    model.renderingStopToken = undefined
  }
  model.isLoading = false
  model.error = undefined
  model.regionTooLargeState = false
  model.regionTooLargeReasonState = ''
  model.fetchGeneration++
}

function forceLoad(model: LifecycleModel) {
  model.regionTooLargeState = false
  model.regionTooLargeReasonState = ''
  clearAllRpcData(model)
}

describe('withFetchLifecycle state management', () => {
  it('sets isLoading=true at start and false when work completes', async () => {
    const model = createModel()
    expect(model.isLoading).toBe(false)

    let loadingDuringWork = false
    await withFetchLifecycle(model, null, async () => {
      loadingDuringWork = model.isLoading
    })

    expect(loadingDuringWork).toBe(true)
    expect(model.isLoading).toBe(false)
  })

  it('sets isLoading=false when tooLarge triggers', async () => {
    const model = createModel()

    await withFetchLifecycle(
      model,
      async () => ({ tooLarge: true, reason: 'too big' }),
      async () => {},
    )

    expect(model.regionTooLargeState).toBe(true)
    expect(model.isLoading).toBe(false)
    expect(model.renderingStopToken).toBeUndefined()
  })

  it('sets isLoading=false when work throws', async () => {
    const model = createModel()

    await withFetchLifecycle(model, null, async () => {
      throw new Error('work failed')
    })

    expect(model.isLoading).toBe(false)
    expect(model.error).toBeTruthy()
  })

  it('does not leave stale state after tooLarge then force load', async () => {
    const model = createModel()

    await withFetchLifecycle(
      model,
      async () => ({ tooLarge: true, reason: 'too big' }),
      async () => {},
    )

    expect(model.regionTooLargeState).toBe(true)
    expect(model.isLoading).toBe(false)

    forceLoad(model)

    expect(model.regionTooLargeState).toBe(false)
    expect(model.isLoading).toBe(false)

    await withFetchLifecycle(model, null, async () => {})

    expect(model.isLoading).toBe(false)
    expect(model.regionTooLargeState).toBe(false)
  })

  it('cancels previous fetch when a new one starts', async () => {
    const model = createModel()

    let firstWorkRan = false
    let secondWorkRan = false

    const firstFetch = withFetchLifecycle(model, null, async ctx => {
      await new Promise(r => setTimeout(r, 50))
      if (!ctx.isStale()) {
        firstWorkRan = true
      }
    })

    withFetchLifecycle(model, null, async () => {
      secondWorkRan = true
    })

    await firstFetch
    await new Promise(r => setTimeout(r, 60))

    expect(firstWorkRan).toBe(false)
    expect(secondWorkRan).toBe(true)
    expect(model.isLoading).toBe(false)
  })

  it('does not deadlock: repeated tooLarge + forceLoad cycles', async () => {
    const model = createModel()

    for (let i = 0; i < 5; i++) {
      await withFetchLifecycle(
        model,
        async () => ({ tooLarge: true, reason: `cycle ${i}` }),
        async () => {},
      )

      expect(model.regionTooLargeState).toBe(true)
      expect(model.isLoading).toBe(false)
      expect(model.renderingStopToken).toBeUndefined()

      forceLoad(model)

      expect(model.regionTooLargeState).toBe(false)
      expect(model.isLoading).toBe(false)
    }

    await withFetchLifecycle(model, null, async () => {})
    expect(model.isLoading).toBe(false)
    expect(model.regionTooLargeState).toBe(false)
  })

  it('does not loop: tooLarge stops the fetch cycle', async () => {
    const model = createModel()
    let fetchCount = 0

    async function simulateFetchAutorun() {
      if (model.regionTooLargeState || model.error) {
        return
      }
      fetchCount++
      await withFetchLifecycle(
        model,
        async () => ({ tooLarge: true, reason: 'too big' }),
        async () => {},
      )
    }

    await simulateFetchAutorun()
    expect(fetchCount).toBe(1)
    expect(model.regionTooLargeState).toBe(true)

    await simulateFetchAutorun()
    await simulateFetchAutorun()
    expect(fetchCount).toBe(1)
  })

  it('clearAllRpcData during work marks it stale', async () => {
    const model = createModel()
    let workWasStale = false

    const fetchPromise = withFetchLifecycle(model, null, async ctx => {
      await new Promise(r => setTimeout(r, 10))
      workWasStale = ctx.isStale()
    })

    clearAllRpcData(model)

    await fetchPromise

    expect(workWasStale).toBe(true)
    expect(model.isLoading).toBe(false)
  })

  it('error during byte estimate sets error and cleans up loading', async () => {
    const model = createModel()

    await withFetchLifecycle(
      model,
      async () => {
        throw new Error('RPC failed')
      },
      async () => {},
    )

    expect(model.isLoading).toBe(false)
    expect(model.error).toBeTruthy()
    expect(model.renderingStopToken).toBeUndefined()
  })

  it('null byte estimate proceeds directly to work', async () => {
    const model = createModel()
    let workRan = false

    await withFetchLifecycle(
      model,
      async () => null,
      async () => {
        workRan = true
      },
    )

    expect(workRan).toBe(true)
    expect(model.regionTooLargeState).toBe(false)
    expect(model.isLoading).toBe(false)
  })

  it('force load then tooLarge again does not leave isLoading stuck', async () => {
    const model = createModel()

    await withFetchLifecycle(
      model,
      async () => ({ tooLarge: true, reason: 'big' }),
      async () => {},
    )
    expect(model.isLoading).toBe(false)

    forceLoad(model)

    await withFetchLifecycle(
      model,
      async () => ({ tooLarge: true, reason: 'still big' }),
      async () => {},
    )

    expect(model.isLoading).toBe(false)
    expect(model.regionTooLargeState).toBe(true)
    expect(model.renderingStopToken).toBeUndefined()
  })
})
