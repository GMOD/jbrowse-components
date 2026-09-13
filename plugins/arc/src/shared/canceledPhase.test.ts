import { autorun } from 'mobx'

import { createTestEnvironment } from './testEnv.ts'

// A user cancel on a real global-family display, observed through an autorun on
// `displayPhase`. The RPC hangs while `hold` is set, so the cancel lands on a
// fetch genuinely in flight.

function setup() {
  const control = { hold: true }
  const { display, view } = createTestEnvironment(undefined, (_s, method) =>
    method !== 'ArcGetFeatures'
      ? []
      : control.hold
        ? new Promise(() => {})
        : { features: [], bytes: 100 },
  ).createDisplay()
  view.zoomTo(50)
  const seen: string[] = []
  const dispose = autorun(() => {
    const phase = display.displayPhase
    if (seen.at(-1) !== phase) {
      seen.push(phase)
    }
  })
  return { control, display, view, seen, dispose }
}

async function until(predicate: () => boolean) {
  for (let i = 0; i < 150 && !predicate(); i++) {
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  expect(predicate()).toBe(true)
}

// This family keeps no scrim between Retry (or a pan) and its debounced
// refetch, so `ready` may sit between `canceled` and `loading` there.
function afterCancel(seen: string[]) {
  return seen.slice(seen.lastIndexOf('canceled') + 1)
}

async function canceledMidFetch() {
  const env = setup()
  await until(() => env.display.isLoading)
  env.display.cancelFetchByUser()
  env.control.hold = false
  return env
}

test('a cancel mid-fetch is canceled, and stays so past the debounce', async () => {
  const { display, seen, dispose } = await canceledMidFetch()
  expect(display.displayPhase).toBe('canceled')
  await new Promise(resolve => setTimeout(resolve, 1500))
  expect(display.displayPhase).toBe('canceled')
  expect(seen.slice(-2)).toEqual(['loading', 'canceled'])
  dispose()
})

test('Retry goes back through loading to ready', async () => {
  const { display, seen, dispose } = await canceledMidFetch()
  display.reload()
  expect(display.displayPhase).not.toBe('canceled')
  await until(() => display.displayPhase === 'ready' && !!display.features)
  expect(afterCancel(seen)).toContain('loading')
  expect(afterCancel(seen).at(-1)).toBe('ready')
  dispose()
})

test('a pan lapses the cancel and the display loads', async () => {
  const { display, view, seen, dispose } = await canceledMidFetch()
  view.scrollTo(view.offsetPx + view.width * 2)
  expect(display.fetchCanceled).toBe(false)
  await until(() => display.displayPhase === 'ready' && !!display.features)
  expect(afterCancel(seen)).toContain('loading')
  expect(afterCancel(seen).at(-1)).toBe('ready')
  dispose()
})

test('an error outranks a standing cancel', async () => {
  const { display, dispose } = await canceledMidFetch()
  display.setError(new Error('boom'))
  expect(display.displayPhase).toBe('error')
  dispose()
})
