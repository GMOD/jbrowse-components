import { autorun } from 'mobx'

import { createPerRegionTestEnvironment } from './perRegionTestEnv.ts'

import type { LinearGenomeViewModel } from '../LinearGenomeView/model.ts'
import type { PerRegionTestDisplay } from './perRegionTestEnv.ts'

// A user cancel on a real per-region display, observed the way the chrome and
// the app marker observe it: through an autorun on `displayPhase`. `canceled`
// is finished for every readiness reader and still draws the overlay carrying
// Retry, so the transitions below are the whole contract.

jest.setTimeout(30_000)

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

function setup() {
  const env = createPerRegionTestEnvironment()
  const created = env.createDisplay() as {
    display: PerRegionTestDisplay
    view: LinearGenomeViewModel
    track: { setMinimized: (flag: boolean) => void }
  }
  const seen: string[] = []
  const dispose = autorun(() => {
    const phase = created.display.displayPhase
    if (seen.at(-1) !== phase) {
      seen.push(phase)
    }
  })
  return { ...env, ...created, seen, dispose }
}

// the harness has no renderer, so a test marks the paint a real canvas would
async function quiet(display: PerRegionTestDisplay) {
  let last = -1
  let stable = 0
  for (let i = 0; stable < 4; i++) {
    if (i > 100) {
      throw new Error('display never settled')
    }
    await jest.advanceTimersByTimeAsync(200)
    const n = display.fetchLog.length
    stable = n === last && !display.isLoading ? stable + 1 : 0
    last = n
  }
}

async function canceledMidFetch() {
  const env = setup()
  const { display, control } = env
  await quiet(display)
  display.markCanvasDrawn()
  control.fetchDelayMs = 2000
  display.reload()
  await jest.advanceTimersByTimeAsync(700)
  expect(display.isLoading).toBe(true)
  display.cancelFetchByUser()
  control.fetchDelayMs = 0
  return env
}

test('a cancel mid-fetch is canceled, and stays so while nothing moves', async () => {
  const { display, seen, dispose } = await canceledMidFetch()
  expect(display.displayPhase).toBe('canceled')
  await quiet(display)
  expect(display.displayPhase).toBe('canceled')
  expect(seen.slice(-2)).toEqual(['loading', 'canceled'])
  dispose()
})

test('Retry goes back through loading to ready', async () => {
  const { display, seen, dispose } = await canceledMidFetch()
  display.reload()
  expect(display.displayPhase).toBe('loading')
  await quiet(display)
  display.markCanvasDrawn()
  expect(display.displayPhase).toBe('ready')
  expect(seen.slice(-3)).toEqual(['canceled', 'loading', 'ready'])
  dispose()
})

test('a pan lapses the cancel and the display loads', async () => {
  const { display, view, seen, dispose } = await canceledMidFetch()
  view.scrollTo(view.offsetPx + view.width * 4)
  await quiet(display)
  display.markCanvasDrawn()
  expect(display.fetchCanceled).toBe(false)
  expect(display.displayPhase).toBe('ready')
  expect(seen.slice(-3)).toEqual(['canceled', 'loading', 'ready'])
  dispose()
})

// The capture census keys on `data-display-drawn`, which is `painted`. A cancel
// before first paint has to answer painted, or every capture wait burns its
// timeout on a display nothing will ever draw instead of naming the cancel.
test('a cancel before first paint reports painted, so the census names it', async () => {
  const { display, control, dispose } = setup()
  control.fetchDelayMs = 2000
  await jest.advanceTimersByTimeAsync(700)
  expect(display.isLoading).toBe(true)
  expect(display.painted).toBe(false)
  display.cancelFetchByUser()
  control.fetchDelayMs = 0
  expect(display.displayPhase).toBe('canceled')
  expect(display.painted).toBe(true)
  dispose()
})

test('a minimized canceled track reads ready, and canceled again when restored', async () => {
  const { display, track, dispose } = await canceledMidFetch()
  track.setMinimized(true)
  expect(display.displayPhase).toBe('ready')
  track.setMinimized(false)
  expect(display.displayPhase).toBe('canceled')
  dispose()
})

test('an error outranks a standing cancel', async () => {
  const { display, dispose } = await canceledMidFetch()
  display.setError(new Error('boom'))
  expect(display.displayPhase).toBe('error')
  dispose()
})
