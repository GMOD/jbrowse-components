import PluginManager from './PluginManager.ts'

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
