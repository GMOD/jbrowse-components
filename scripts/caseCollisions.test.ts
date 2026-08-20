import { findCaseCollisions } from './caseCollisions.ts'

// Synthetic path lists, never a fixture on disk: writing the second spelling of
// a pair is exactly the operation that, on the filesystem this guards, lands on
// the first one instead. The three shapes below are the three that shipped.

test('a component beside its logic under the same name', () => {
  const { collisions } = findCaseCollisions([
    'packages/core/src/ui/menuItems.ts',
    'packages/core/src/ui/MenuItems.tsx',
    'packages/core/src/ui/menuLabels.ts',
  ])
  expect(collisions).toEqual([
    ['packages/core/src/ui/MenuItems', 'packages/core/src/ui/menuItems'],
  ])
})

test('the directory is folded too, not just the basename', () => {
  const { collisions } = findCaseCollisions([
    'packages/core/src/ui/theme.ts',
    'packages/core/src/UI/theme.ts',
  ])
  expect(collisions).toEqual([
    ['packages/core/src/UI/theme', 'packages/core/src/ui/theme'],
  ])
})

test('same stem in different directories is not a collision', () => {
  const { collisions } = findCaseCollisions([
    'packages/core/src/ui/model.ts',
    'plugins/wiggle/src/model.ts',
  ])
  expect(collisions).toEqual([])
})

// A `.ts` and a `.tsx` of the SAME spelling cannot coexist in git either, but
// the interesting half is that differing extensions do not excuse the pair:
// both compile to one `.js`.
test('differing extensions do not separate the outputs', () => {
  const { collisions } = findCaseCollisions([
    'a/scoreRules.ts',
    'a/ScoreRules.tsx',
    'a/scoreRules.test.ts',
    'a/ScoreRules.test.tsx',
  ])
  expect(collisions).toEqual([
    ['a/ScoreRules', 'a/scoreRules'],
    ['a/ScoreRules.test', 'a/scoreRules.test'],
  ])
})

test('non-compiled neighbours are left alone', () => {
  const { collisions, stems } = findCaseCollisions([
    'docs/README.md',
    'docs/readme.md',
    'a/x.ts',
  ])
  expect(collisions).toEqual([])
  expect(stems).toBe(1)
})
