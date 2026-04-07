import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'

import type { StopToken } from '@jbrowse/core/util/stopToken'

interface Region {
  refName: string
  start: number
  end: number
  assemblyName: string
}

interface RegionWithNumber {
  region: Region
  regionNumber: number
}

interface LifecycleModel {
  readonly isLoading: boolean
  error: unknown
  renderingStopToken: StopToken | undefined
  fetchGeneration: number
  regionTooLargeState: boolean
  regionTooLargeReasonState: string
  statusMessage: string | undefined
  loadedRegions: Map<number, Region>
  dataVersion: number
}

interface FetchContext {
  stopToken: StopToken
  generation: number
  isStale: () => boolean
}

function makeRegion(refName: string, start: number, end: number): Region {
  return { refName, start, end, assemblyName: 'test' }
}

function createModel(): LifecycleModel {
  return {
    get isLoading() {
      return this.renderingStopToken !== undefined
    },
    error: undefined,
    renderingStopToken: undefined,
    fetchGeneration: 0,
    regionTooLargeState: false,
    regionTooLargeReasonState: '',
    statusMessage: undefined,
    loadedRegions: new Map(),
    dataVersion: 0,
  }
}

function setLoadedRegionForRegion(
  model: LifecycleModel,
  regionNumber: number,
  region: Region,
) {
  const next = new Map(model.loadedRegions)
  next.set(regionNumber, region)
  model.loadedRegions = next
  model.dataVersion++
}

function withFetchLifecycle(
  model: LifecycleModel,
  needed: RegionWithNumber[],
  byteEstimate:
    | (() => Promise<{
        tooLarge: boolean
        reason?: string
      } | null>)
    | null,
  work: (ctx: FetchContext) => Promise<void>,
) {
  if (model.renderingStopToken) {
    stopStopToken(model.renderingStopToken)
  }
  const stopToken = createStopToken()
  const generation = model.fetchGeneration
  model.renderingStopToken = stopToken
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
            model.statusMessage = undefined
            return
          }
        }
      }
      model.regionTooLargeState = false
      await work(ctx)
      if (!isStale()) {
        for (const { regionNumber, region } of needed) {
          setLoadedRegionForRegion(model, regionNumber, region)
        }
      }
    } catch (e) {
      if (!isStale()) {
        model.error = e
      }
    } finally {
      if (!isStale()) {
        model.renderingStopToken = undefined
        model.statusMessage = undefined
        model.fetchGeneration++
      }
    }
  })()
}

function clearAllRpcData(model: LifecycleModel) {
  if (model.renderingStopToken) {
    stopStopToken(model.renderingStopToken)
    model.renderingStopToken = undefined
  }
  model.error = undefined
  model.regionTooLargeState = false
  model.regionTooLargeReasonState = ''
  model.fetchGeneration++
}

function invalidateLoadedRegions(model: LifecycleModel) {
  if (model.renderingStopToken) {
    stopStopToken(model.renderingStopToken)
    model.renderingStopToken = undefined
  }
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
    await withFetchLifecycle(model, [], null, async () => {
      loadingDuringWork = model.isLoading
    })

    expect(loadingDuringWork).toBe(true)
    expect(model.isLoading).toBe(false)
  })

  it('sets isLoading=false when tooLarge triggers', async () => {
    const model = createModel()

    await withFetchLifecycle(
      model,
      [],
      async () => ({ tooLarge: true, reason: 'too big' }),
      async () => {},
    )

    expect(model.regionTooLargeState).toBe(true)
    expect(model.isLoading).toBe(false)
    expect(model.renderingStopToken).toBeUndefined()
  })

  it('sets isLoading=false when work throws', async () => {
    const model = createModel()

    await withFetchLifecycle(model, [], null, async () => {
      throw new Error('work failed')
    })

    expect(model.isLoading).toBe(false)
    expect(model.error).toBeTruthy()
  })

  it('does not leave stale state after tooLarge then force load', async () => {
    const model = createModel()

    await withFetchLifecycle(
      model,
      [],
      async () => ({ tooLarge: true, reason: 'too big' }),
      async () => {},
    )

    expect(model.regionTooLargeState).toBe(true)
    expect(model.isLoading).toBe(false)

    forceLoad(model)

    expect(model.regionTooLargeState).toBe(false)
    expect(model.isLoading).toBe(false)

    await withFetchLifecycle(model, [], null, async () => {})

    expect(model.isLoading).toBe(false)
    expect(model.regionTooLargeState).toBe(false)
  })

  it('cancels previous fetch when a new one starts', async () => {
    const model = createModel()

    let firstWorkRan = false
    let secondWorkRan = false

    const firstFetch = withFetchLifecycle(model, [], null, async ctx => {
      await new Promise(r => setTimeout(r, 50))
      if (!ctx.isStale()) {
        firstWorkRan = true
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    withFetchLifecycle(model, [], null, async () => {
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
        [],
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

    await withFetchLifecycle(model, [], null, async () => {})
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
        [],
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

    const fetchPromise = withFetchLifecycle(model, [], null, async ctx => {
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
      [],
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
      [],
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
      [],
      async () => ({ tooLarge: true, reason: 'big' }),
      async () => {},
    )
    expect(model.isLoading).toBe(false)

    forceLoad(model)

    await withFetchLifecycle(
      model,
      [],
      async () => ({ tooLarge: true, reason: 'still big' }),
      async () => {},
    )

    expect(model.isLoading).toBe(false)
    expect(model.regionTooLargeState).toBe(true)
    expect(model.renderingStopToken).toBeUndefined()
  })

  it('invalidateLoadedRegions marks current work stale without clearing error', async () => {
    const model = createModel()
    let workWasStale = false

    const fetchPromise = withFetchLifecycle(model, [], null, async ctx => {
      await new Promise(r => setTimeout(r, 10))
      workWasStale = ctx.isStale()
    })

    invalidateLoadedRegions(model)

    await fetchPromise

    expect(workWasStale).toBe(true)
    expect(model.error).toBeUndefined()
    expect(model.regionTooLargeState).toBe(false)
  })

  it('invalidateLoadedRegions preserves error and tooLarge state', () => {
    const model = createModel()
    model.error = new Error('something')
    model.regionTooLargeState = true

    invalidateLoadedRegions(model)

    expect(model.error).toBeTruthy()
    expect(model.regionTooLargeState).toBe(true)
  })

  it('invalidateLoadedRegions inside work triggers re-fetch without data loss', async () => {
    const model = createModel()
    let firstWorkRan = false
    let secondWorkRan = false

    await withFetchLifecycle(model, [], null, async ctx => {
      firstWorkRan = true
      invalidateLoadedRegions(model)
      expect(ctx.isStale()).toBe(true)
    })

    expect(firstWorkRan).toBe(true)

    await withFetchLifecycle(model, [], null, async () => {
      secondWorkRan = true
    })

    expect(secondWorkRan).toBe(true)
    expect(model.isLoading).toBe(false)
  })
})

describe('data-before-loaded invariant', () => {
  const needed: RegionWithNumber[] = [
    { regionNumber: 0, region: makeRegion('chr1', 0, 1000) },
    { regionNumber: 1, region: makeRegion('chr1', 1000, 2000) },
  ]

  it('marks regions loaded only after work callback completes', async () => {
    const model = createModel()
    const dataMap = new Map<number, string>()
    let dataVersionDuringWork = -1

    await withFetchLifecycle(model, needed, null, async () => {
      dataMap.set(0, 'region0-data')
      dataMap.set(1, 'region1-data')
      dataVersionDuringWork = model.dataVersion
    })

    expect(dataVersionDuringWork).toBe(0)
    expect(model.dataVersion).toBe(2)
    expect(model.loadedRegions.size).toBe(2)
    expect(model.loadedRegions.get(0)?.refName).toBe('chr1')
    expect(model.loadedRegions.get(1)?.start).toBe(1000)
  })

  it('does not mark regions loaded when work throws', async () => {
    const model = createModel()

    await withFetchLifecycle(model, needed, null, async () => {
      throw new Error('fetch failed')
    })

    expect(model.loadedRegions.size).toBe(0)
    expect(model.dataVersion).toBe(0)
    expect(model.error).toBeTruthy()
  })

  it('does not mark regions loaded when stale', async () => {
    const model = createModel()

    await withFetchLifecycle(model, needed, null, async () => {
      clearAllRpcData(model)
    })

    expect(model.loadedRegions.size).toBe(0)
    expect(model.dataVersion).toBe(0)
  })

  it('simulates display pattern: data populated before dataVersion bumps', async () => {
    const model = createModel()
    const rpcDataMap = new Map<number, unknown>()
    const events: string[] = []

    await withFetchLifecycle(model, needed, null, async () => {
      rpcDataMap.set(0, { features: [1, 2, 3] })
      rpcDataMap.set(1, { features: [4, 5] })
      events.push('data-set')
    })

    events.push(
      `loaded-regions:${model.loadedRegions.size}`,
      `data-version:${model.dataVersion}`,
    )

    expect(events).toEqual(['data-set', 'loaded-regions:2', 'data-version:2'])
    expect(rpcDataMap.size).toBe(2)
    expect(model.loadedRegions.size).toBe(2)
  })

  it('does not mark regions loaded when tooLarge', async () => {
    const model = createModel()

    await withFetchLifecycle(
      model,
      needed,
      async () => ({ tooLarge: true, reason: 'too many features' }),
      async () => {},
    )

    expect(model.loadedRegions.size).toBe(0)
    expect(model.dataVersion).toBe(0)
    expect(model.regionTooLargeState).toBe(true)
  })

  it('second fetch updates loaded regions for requested region numbers', async () => {
    const model = createModel()

    await withFetchLifecycle(model, needed, null, async () => {})

    expect(model.loadedRegions.size).toBe(2)
    expect(model.dataVersion).toBe(2)

    const needed2: RegionWithNumber[] = [
      { regionNumber: 0, region: makeRegion('chr2', 0, 500) },
    ]

    await withFetchLifecycle(model, needed2, null, async () => {})

    expect(model.loadedRegions.get(0)?.refName).toBe('chr2')
    expect(model.loadedRegions.get(1)?.refName).toBe('chr1')
  })
})
