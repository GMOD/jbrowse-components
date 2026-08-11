import { buildTree } from './clusterUtils.ts'
import { clusterLayout } from './hierarchy.ts'
import { buildSpatialIndex, pickTreeNode } from './spatialIndex.ts'

// 4 leaves, so rows sit at x = 12.5, 37.5, 62.5, 87.5 over a 100px row axis.
const laid = clusterLayout(buildTree('((a,b),(c,d));'), 100, 80)

test('indexes internal nodes only', () => {
  // root + the two clades; the four leaves are not selectable subtrees
  expect(buildSpatialIndex(laid)!.nodes).toHaveLength(3)
})

test('undefined for no tree, and for a tree with no internal nodes', () => {
  expect(buildSpatialIndex(undefined)).toBeUndefined()
  expect(
    buildSpatialIndex(clusterLayout(buildTree('a;'), 100, 80)),
  ).toBeUndefined()
})

test('picks the node under the cursor', () => {
  const index = buildSpatialIndex(laid)!
  const ab = laid.children![0]!
  expect(pickTreeNode(index, ab.y, ab.x)).toBe(ab)
})

test('undefined over empty tree area', () => {
  expect(pickTreeNode(buildSpatialIndex(laid)!, 1000, 1000)).toBeUndefined()
})

// Hit boxes are 8px square and a dendrogram stacks parent above child, so
// several overlap under one cursor position. `index.search` returns them in
// tree order, which is arbitrary with respect to the cursor -- taking its first
// match made the hover jump to whichever node came earlier in the traversal.
test('picks the nearest node when hit boxes overlap', () => {
  // a squeezed sidebar (20px of rows, 10px of tree) packs the nodes inside one
  // 8px hit radius of each other, which is the case the distance sort exists
  // for -- a wide tree separates them and any pick would look right
  const tight = clusterLayout(buildTree('((a,b),(c,d));'), 20, 10)
  const index = buildSpatialIndex(tight)!
  const root = tight
  const ab = tight.children![0]!
  // sanity: they really do overlap, so this is testing something
  expect(Math.abs(root.y - ab.y)).toBeLessThan(8)
  expect(Math.abs(root.x - ab.x)).toBeLessThan(8)
  // sitting exactly on each one picks that one, not whichever comes first in
  // tree order (the root, for both)
  expect(pickTreeNode(index, root.y, root.x)).toBe(root)
  expect(pickTreeNode(index, ab.y, ab.x)).toBe(ab)
})
