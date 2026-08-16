import PluginManager from './PluginManager.ts'

import type { ReplaceWidgetProps } from './PluginManager.ts'

// an unregistered name hits the loose overloads, which is what a plugin-defined
// point looks like before anyone types it
const POINT = 'Test-point'

function quiet() {
  return jest.spyOn(console, 'error').mockImplementation(() => {})
}

test('callbacks accumulate, each receiving the previous return value', () => {
  const pm = new PluginManager([])
  pm.addToExtensionPoint<number>(POINT, n => n + 1)
  pm.addToExtensionPoint<number>(POINT, n => n * 10)
  expect(pm.evaluateExtensionPoint(POINT, 1)).toBe(20)
})

test('props pass through unchanged rather than accumulating', () => {
  const pm = new PluginManager([])
  const seen: unknown[] = []
  pm.addToExtensionPoint<number>(POINT, (n, props) => {
    seen.push(props)
    return n + 1
  })
  pm.addToExtensionPoint<number>(POINT, (n, props) => {
    seen.push(props)
    return n + 1
  })
  const props = { session: 'x' }
  pm.evaluateExtensionPoint(POINT, 0, props)
  expect(seen).toEqual([props, props])
})

// "return what you were passed" is how a callback opts out, so forgetting the
// return used to hand undefined to every later callback and to the producer
test('a callback that returns nothing leaves the accumulator alone', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const pm = new PluginManager([])
  pm.addToExtensionPoint<number>(POINT, n => n + 1)
  pm.addToExtensionPoint<number>(POINT, (() => {}) as () => number)
  pm.addToExtensionPoint<number>(POINT, n => n + 1)
  expect(pm.evaluateExtensionPoint(POINT, 0)).toBe(2)
  expect(warn).toHaveBeenCalled()
  warn.mockRestore()
})

// a point whose args are undefined to begin with is notification-style, and
// there every callback returns undefined legitimately
test('a point started with undefined does not warn', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const pm = new PluginManager([])
  pm.addToExtensionPoint<undefined>(POINT, arg => arg)
  expect(pm.evaluateExtensionPoint(POINT, undefined)).toBeUndefined()
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
})

// typecheck-only: a point that declares props must be given them, or every
// callback destructures undefined. Unused @ts-expect-error fails `pnpm
// typecheck`, so this is a real assertion despite running nothing
test('a point that declares props requires them at the fire site', () => {
  const pm = new PluginManager([])
  const Widget = () => null
  // @ts-expect-error Core-replaceWidget declares props, so they are required
  pm.evaluateExtensionPoint('Core-replaceWidget', Widget)
  expect(
    pm.evaluateExtensionPoint('Core-replaceWidget', Widget, {
      model: { type: 'W' },
      session: {} as ReplaceWidgetProps['session'],
    }),
  ).toBe(Widget)
})

test('an unregistered point returns the args untouched', () => {
  expect(new PluginManager([]).evaluateExtensionPoint(POINT, 'unchanged')).toBe(
    'unchanged',
  )
})

// one plugin failing must not sink the others, so the accumulator carries the
// last good value past the thrower
test('the sync runner swallows a throwing callback and continues', () => {
  const spy = quiet()
  const pm = new PluginManager([])
  pm.addToExtensionPoint<number>(POINT, n => n + 1)
  pm.addToExtensionPoint<number>(POINT, () => {
    throw new Error('boom')
  })
  pm.addToExtensionPoint<number>(POINT, n => n + 1)
  expect(pm.evaluateExtensionPoint(POINT, 0)).toBe(2)
  expect(spy).toHaveBeenCalled()
  spy.mockRestore()
})

test('the async runner swallows a rejecting callback and continues', async () => {
  const spy = quiet()
  const pm = new PluginManager([])
  pm.addToExtensionPoint<number>(POINT, n => n + 1)
  pm.addToExtensionPoint<number>(POINT, () => Promise.reject(new Error('boom')))
  pm.addToExtensionPoint<number>(POINT, n => n + 1)
  await expect(pm.evaluateAsyncExtensionPoint(POINT, 0)).resolves.toBe(2)
  expect(spy).toHaveBeenCalled()
  spy.mockRestore()
})

// side-effecting points (launching a view from a hub or a session spec) want
// the error to reach the caller, which owns the failure policy — swallowing it
// leaves the user with a success message and nothing on screen
test('the strict async runner propagates instead of swallowing', async () => {
  const pm = new PluginManager([])
  const after = jest.fn()
  pm.addToExtensionPoint<number>(POINT, () => {
    throw new Error('boom')
  })
  pm.addToExtensionPoint<number>(POINT, after)
  await expect(pm.evaluateAsyncExtensionPointStrict(POINT, 0)).rejects.toThrow(
    'boom',
  )
  expect(after).not.toHaveBeenCalled()
})

// A notification point carries no data, so its folded value is only ever a
// completion signal: the promise a producer awaits to learn that handlers have
// finished trying. Under the *sync* runner nothing awaits between callbacks, so
// each observer's promise had to survive being handed to the next one — and
// returning only its own discarded the earlier one, leaving assemblyManager's
// waitForAssembly waiting on whichever handler happened to register last rather
// than on the one supplying the assembly.
test('two async observers both settle before the folded promise does', async () => {
  const pm = new PluginManager([])
  const done: string[] = []
  const settle = (name: string, ms: number) =>
    new Promise<void>(resolve => {
      setTimeout(() => {
        done.push(name)
        resolve()
      }, ms)
    })
  // the slow one first, so "last registered wins" would resolve without it
  pm.listenToExtensionPoint('Core-handleUnrecognizedAssembly', () =>
    settle('slow', 20),
  )
  pm.listenToExtensionPoint('Core-handleUnrecognizedAssembly', () =>
    settle('fast', 0),
  )
  await pm.evaluateExtensionPoint(
    'Core-handleUnrecognizedAssembly',
    undefined,
    {
      assemblyName: 'volvox',
    },
  )
  expect(done).toEqual(['fast', 'slow'])
})

// the other half of the same branch: a sync observer contributes no completion
// signal of its own, so it must hand the accumulated promise along untouched
test('a sync observer passes an accumulated completion promise through', async () => {
  const pm = new PluginManager([])
  const done: string[] = []
  pm.listenToExtensionPoint(
    'Core-handleUnrecognizedAssembly',
    () =>
      new Promise<void>(resolve => {
        setTimeout(() => {
          done.push('async')
          resolve()
        }, 20)
      }),
  )
  pm.listenToExtensionPoint('Core-handleUnrecognizedAssembly', () => {
    done.push('sync')
  })
  await pm.evaluateExtensionPoint(
    'Core-handleUnrecognizedAssembly',
    undefined,
    {
      assemblyName: 'volvox',
    },
  )
  expect(done).toEqual(['sync', 'async'])
})

// typecheck-only, the way accumulatingExtensionPoint.test.tsx asserts its
// guarantee: an unused @ts-expect-error fails `pnpm typecheck`. The two tests
// above are what listenToExtensionPoint is FOR — joining the handlers' promises
// so a producer learns when they have all finished — and neither happens if a
// plugin reaches the same point through addToExtensionPoint instead. Nothing
// stopped it doing that until this exclusion, and the failure is a producer
// that stops waiting early, which looks like a race rather than like a wrong
// registration method.
test('addToExtensionPoint refuses a notification point', () => {
  const pm = new PluginManager([])
  // @ts-expect-error notification points go through listenToExtensionPoint
  pm.addToExtensionPoint('Core-handleUnrecognizedAssembly', arg => arg)
  expect(
    pm.extensionPointCallbackCount('Core-handleUnrecognizedAssembly'),
  ).toBe(1)
})
