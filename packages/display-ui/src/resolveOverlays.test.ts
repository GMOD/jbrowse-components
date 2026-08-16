import { resolveOverlays } from './DisplayUIProvider.tsx'
import plainChromeOverlays from './plainChromeOverlays.tsx'

// Identity, not contents, is what this has to get right: the result is a
// context value, and a fresh one each render re-renders every display beneath
// the provider — with `observer()`'s `React.memo` defeated on each display's
// whole chrome. A test of the merged keys would pass on the version that
// rebuilds every time.

const MyErrorBar = () => null

test('no argument is the plain set itself, not a copy of it', () => {
  expect(resolveOverlays()).toBe(plainChromeOverlays)
})

test('one identity per caller object, however often it is resolved', () => {
  const mine = { ErrorBar: MyErrorBar }
  expect(resolveOverlays(mine)).toBe(resolveOverlays(mine))
})

test('a partial set fills the rest in from the plain one', () => {
  const resolved = resolveOverlays({ ErrorBar: MyErrorBar })
  expect(resolved.ErrorBar).toBe(MyErrorBar)
  expect(resolved.TooLarge).toBe(plainChromeOverlays.TooLarge)
  // the state a host never names is the one that matters here: a set written
  // whole goes stale when JBrowse adds a sixth, and this one does not
  expect(Object.keys(resolved).sort()).toEqual(
    Object.keys(plainChromeOverlays).sort(),
  )
})

test('two callers with equal but separate objects stay separate', () => {
  // documenting the limit rather than the feature: keyed on identity, so a host
  // rebuilding their set each render gets a new one each render. The provider's
  // JSDoc says to hold it still, and this is what "still" means.
  expect(resolveOverlays({ ErrorBar: MyErrorBar })).not.toBe(
    resolveOverlays({ ErrorBar: MyErrorBar }),
  )
})
