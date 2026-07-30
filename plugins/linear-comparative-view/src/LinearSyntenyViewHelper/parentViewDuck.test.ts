import { isSyntenyLevel } from './parentViewDuck.ts'

// Replaces syntenyBounds.test.ts, which defined its own copies of the
// level-pairing helpers inside the test file and asserted on those — so it could
// never fail for a product reason. This tests the one predicate the real walk
// uses.
test('a level is recognized by its view type', () => {
  expect(isSyntenyLevel({ type: 'LinearSyntenyViewHelper', height: 100 })).toBe(
    true,
  )
})

test('the containing view and the tracks between are not levels', () => {
  // the nodes the walk passes through on its way up from a display: the track,
  // then (if the predicate were loose) the LinearSyntenyView itself
  expect(isSyntenyLevel({ type: 'SyntenyTrack' })).toBe(false)
  expect(isSyntenyLevel({ type: 'LinearSyntenyView', height: 400 })).toBe(false)
})

test('a node carrying no type is not a level', () => {
  // MST array nodes (displays[], tracks[], levels[]) are every other hop
  expect(isSyntenyLevel([])).toBe(false)
  expect(isSyntenyLevel({ height: 100, level: 0 })).toBe(false)
  expect(isSyntenyLevel(undefined)).toBe(false)
})
