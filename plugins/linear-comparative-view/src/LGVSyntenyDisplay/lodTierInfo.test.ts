import { createSyntenyEnv } from './testEnv.ts'

// The display's `lodTier` is resolved off the config slot until the one-shot
// `CoreGetInfo` read in afterAttach (`installLodTierInfoFetch`) says what the
// file actually holds. These pin the two halves of that contract: the file has
// the last word, and a file built with the defaults must not move the fetch key
// when its info lands.

const tiered = {
  name: 'TieredTestAdapter',
  slots: {
    coarseBpPerPxThreshold: { type: 'number' as const, defaultValue: 10000 },
  },
}

function flush() {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

function openTiered(info: unknown) {
  const methods: string[] = []
  const env = createSyntenyEnv({
    adapter: tiered,
    rpcCall: (_sessionId, method) => {
      methods.push(method)
      return method !== 'CoreGetInfo'
        ? new Promise(() => {})
        : info instanceof Error
          ? Promise.reject(info)
          : Promise.resolve(info)
    },
  })
  return { ...env, methods }
}

// 16 Mb across 800 px fits at 20,000 bp/px, past the default threshold. A
// placement rather than a `zoomTo`: the tier resolves off the settled zoom, and
// a gesture settles on the coarse-block throttle these tests never wait out.
function zoomOut(view: ReturnType<typeof createSyntenyEnv>['view']) {
  view.setDisplayedRegions([
    { refName: 'ctgA', start: 0, end: 16_000_000, assemblyName: 'volvox' },
  ])
  view.setNewView(20000, 0)
  expect(view.coarseBpPerPx).toBeGreaterThanOrEqual(10000)
}

// The tier is the zoom axis of the fetch key and a call-site argument, not a
// settings field: a flip moves `zoomFetchKey` alone, so the held regions draw
// on until the refetch lands instead of being superseded and scrimmed. Off the
// settled zoom, so a gesture through the threshold reads as superseded until
// it lands, and refetches once.
test('a tier flip is a zoom-key move, not a settings change', async () => {
  const { display, view } = openTiered({
    hasCoarseTier: true,
    coarseGap: 10000,
  })
  zoomOut(view)
  await flush()
  const settingsKey = display.settingsFetchKey
  expect(display.lodTier).toBe('coarse')
  expect(display.zoomFetchKey).toBe('1|coarse')
  expect(display.rpcProps()).not.toHaveProperty('lodMode')

  view.zoomTo(5000)
  expect(display.lodTier).toBe('coarse')
  expect(display.liveLodTier).toBe('fine')
  expect(display.dataSuperseded).toBe(true)

  view.setNewView(5000, 0)
  expect(display.lodTier).toBe('fine')
  expect(display.dataSuperseded).toBe(false)
  expect(display.zoomFetchKey).toBe('1|fine')
  expect(display.settingsFetchKey).toBe(settingsKey)
})

test('a file with no coarse tier resolves fine once its info lands, whatever the mode', async () => {
  const { display, view } = openTiered({ hasCoarseTier: false })
  zoomOut(view)
  expect(display.lodTier).toBe('coarse')
  await flush()
  expect(display.lodTier).toBe('fine')
  expect(display.zoomFetchKey).toBe('1|fine')
  display.setLodMode('coarse')
  expect(display.lodTier).toBe('fine')
})

// The info arrives after the first fetch may already be keyed, so for the
// common file the two answers have to agree, or the landing refetches
test('a default-built file leaves the resolved tier where it was', async () => {
  const { display, view, methods } = openTiered({
    hasCoarseTier: true,
    coarseGap: 10000,
  })
  zoomOut(view)
  const before = display.regionFetchKey
  await flush()
  expect(display.lodTierInfo).toEqual({ hasCoarseTier: true, coarseGap: 10000 })
  expect(display.regionFetchKey).toBe(before)
  expect(display.lodTier).toBe('coarse')
  // this display's afterAttach sits beside the base alignments display's
  // rather than over it — the fork auto-chains the hook, and the primary fetch
  // has to go on firing
  expect(methods).toEqual(
    expect.arrayContaining(['RenderAlignmentData', 'CoreGetInfo']),
  )
})

test('a header bound above the slot raises the threshold to it', async () => {
  const { display, view } = openTiered({
    hasCoarseTier: true,
    coarseGap: 50000,
  })
  zoomOut(view)
  await flush()
  expect(display.lodTier).toBe('fine')
})

test('a track with no tiering slot never asks', async () => {
  const methods: string[] = []
  const { display } = createSyntenyEnv({
    rpcCall: (_sessionId, method) => {
      methods.push(method)
      return new Promise(() => {})
    },
  })
  await flush()
  expect(methods).not.toContain('CoreGetInfo')
  expect(display.lodTierInfo).toBeUndefined()
})

// Not terminal: the slot is what the display resolved off before the header
// existed, and the primary fetch on the same file raises the real error
test('a failed read keeps the configured threshold and only warns', async () => {
  const reported = jest.spyOn(console, 'error').mockImplementation(() => {})
  const { display, view } = openTiered(new Error('index unreachable'))
  zoomOut(view)
  await flush()
  expect(`${reported.mock.calls[0]?.[0]}`).toContain('index unreachable')
  reported.mockRestore()
  expect(display.lodTierInfo).toBeUndefined()
  expect(display.lodTier).toBe('coarse')
  expect(display.error).toBeUndefined()
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining('index unreachable'),
  )
})
