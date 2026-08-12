import {
  addViewToPanel,
  isBranch,
  moveViewToPanel,
  normalize,
  panels,
  removePanel,
  removeView,
  setSizes,
  splitPanel,
} from './tree.ts'

import type { LayoutTree, PanelNode } from './tree.ts'

function panel(id: string, viewIds: string[] = [], size = 1): PanelNode {
  return { id, size, viewIds }
}

const sizesOf = (node: LayoutTree) =>
  isBranch(node) ? node.children.map(c => Number(c.size.toFixed(4))) : []

// Canonical form, stated once so every test can assert it rather than restate
// it. These are the invariants normalize() exists to establish.
function expectCanonical(node: LayoutTree) {
  if (!isBranch(node)) {
    return
  }
  expect(node.children.length).toBeGreaterThan(1)
  const total = node.children.reduce((sum, c) => sum + c.size, 0)
  expect(total).toBeCloseTo(1, 6)
  for (const child of node.children) {
    expect(child.size).toBeGreaterThan(0)
    if (isBranch(child)) {
      expect(child.direction).not.toBe(node.direction)
    }
    expectCanonical(child)
  }
}

describe('normalize', () => {
  test('a branch with one child becomes that child, keeping its size', () => {
    const result = normalize({
      id: 'b',
      size: 0.25,
      direction: 'row',
      children: [panel('p1', ['v1'], 1)],
    })
    expect(result.id).toBe('p1')
    expect(result.size).toBe(0.25)
  })

  test('an empty branch is dropped by its parent', () => {
    const result = normalize({
      id: 'root',
      size: 1,
      direction: 'row',
      children: [
        panel('p1'),
        panel('p2'),
        { id: 'empty', size: 1, direction: 'column', children: [] },
      ],
    })
    expect(panels(result).map(p => p.id)).toEqual(['p1', 'p2'])
    expectCanonical(result)
  })

  test('same-direction nesting is flattened, preserving share of the whole', () => {
    // p1 takes half; the inner row takes the other half and splits it evenly,
    // so p2 and p3 must each end up at a quarter once flattened.
    const result = normalize({
      id: 'root',
      size: 1,
      direction: 'row',
      children: [
        panel('p1', [], 1),
        {
          id: 'inner',
          size: 1,
          direction: 'row',
          children: [panel('p2', [], 1), panel('p3', [], 1)],
        },
      ],
    })
    expect(panels(result).map(p => p.id)).toEqual(['p1', 'p2', 'p3'])
    expect(sizesOf(result)).toEqual([0.5, 0.25, 0.25])
    expectCanonical(result)
  })

  test('alternating directions are left nested', () => {
    const result = normalize({
      id: 'root',
      size: 1,
      direction: 'row',
      children: [
        panel('p1'),
        {
          id: 'inner',
          size: 1,
          direction: 'column',
          children: [panel('p2'), panel('p3')],
        },
      ],
    })
    expect(isBranch(result) && result.children.length).toBe(2)
    expectCanonical(result)
  })

  test('is idempotent', () => {
    const messy: LayoutTree = {
      id: 'root',
      size: 1,
      direction: 'row',
      children: [
        { id: 'solo', size: 3, direction: 'column', children: [panel('p1')] },
        {
          id: 'inner',
          size: 1,
          direction: 'row',
          children: [
            panel('p2'),
            { id: 'gone', size: 1, direction: 'row', children: [] },
          ],
        },
      ],
    }
    const once = normalize(messy)
    expect(normalize(once)).toEqual(once)
    expectCanonical(once)
  })

  test('an empty panel survives — it is what a new empty tab is', () => {
    const result = normalize({
      id: 'root',
      size: 1,
      direction: 'row',
      children: [panel('p1', ['v1']), panel('p2', [])],
    })
    expect(panels(result).map(p => p.id)).toEqual(['p1', 'p2'])
  })
})

describe('splitPanel', () => {
  test('splitting the root panel makes a branch', () => {
    const result = splitPanel(panel('p1', ['v1']), 'p1', 'row', panel('p2'))
    expect(isBranch(result)).toBe(true)
    expect(panels(result).map(p => p.id)).toEqual(['p1', 'p2'])
    expect(sizesOf(result)).toEqual([0.5, 0.5])
    expectCanonical(result)
  })

  test('splitting in the parent direction inserts a sibling, not a nest', () => {
    const twoWide = splitPanel(panel('p1'), 'p1', 'row', panel('p2'))
    const threeWide = splitPanel(twoWide, 'p2', 'row', panel('p3'))
    expect(panels(threeWide).map(p => p.id)).toEqual(['p1', 'p2', 'p3'])
    expect(
      isBranch(threeWide) && threeWide.children.every(c => !isBranch(c)),
    ).toBe(true)
    expectCanonical(threeWide)
  })

  test('splitting across the parent direction nests, and sizes hold at depth', () => {
    const twoWide = splitPanel(panel('p1'), 'p1', 'row', panel('p2'))
    const nested = splitPanel(twoWide, 'p2', 'column', panel('p3'))
    expect(panels(nested).map(p => p.id)).toEqual(['p1', 'p2', 'p3'])
    // p1 still owns half the width; p2/p3 share the other half vertically.
    // dockview cannot express this, which is why `size` only ever worked on the
    // top-level split there.
    expect(sizesOf(nested)).toEqual([0.5, 0.5])
    const right = isBranch(nested) ? nested.children[1]! : nested
    expect(isBranch(right) && right.direction).toBe('column')
    expect(sizesOf(right)).toEqual([0.5, 0.5])
    expectCanonical(nested)
  })

  test('before=true puts the new panel first', () => {
    const result = splitPanel(panel('p1'), 'p1', 'row', panel('p2'), true)
    expect(panels(result).map(p => p.id)).toEqual(['p2', 'p1'])
  })
})

describe('removePanel', () => {
  test('the survivor of a two-way split becomes the root, at full size', () => {
    const split = splitPanel(panel('p1'), 'p1', 'row', panel('p2'))
    const result = removePanel(split, 'p2')
    expect(result.id).toBe('p1')
    expect(result.size).toBe(1)
    expectCanonical(result)
  })

  test('removing from a nested split collapses and flattens in one step', () => {
    const twoWide = splitPanel(panel('p1'), 'p1', 'row', panel('p2'))
    const nested = splitPanel(twoWide, 'p2', 'column', panel('p3'))
    const result = removePanel(nested, 'p3')
    // the column branch had one child left, so it collapses to p2, which is
    // then a row inside a row and flattens — p1 and p2 side by side again
    expect(panels(result).map(p => p.id)).toEqual(['p1', 'p2'])
    expect(sizesOf(result)).toEqual([0.5, 0.5])
    expectCanonical(result)
  })

  test('siblings absorb the freed space proportionally', () => {
    let tree = splitPanel(panel('p1'), 'p1', 'row', panel('p2'))
    tree = splitPanel(tree, 'p2', 'row', panel('p3'))
    tree = setSizes(tree, tree.id, [0.6, 0.2, 0.2])
    const result = removePanel(tree, 'p3')
    expect(sizesOf(result)).toEqual([0.75, 0.25])
    expectCanonical(result)
  })

  test('removing the last panel leaves an empty one to put the next view in', () => {
    const result = removePanel(panel('p1', ['v1']), 'p1')
    expect(isBranch(result)).toBe(false)
    expect((result as PanelNode).viewIds).toEqual([])
  })
})

describe('views', () => {
  test('a view moves atomically — never in two panels, never in none', () => {
    const split = splitPanel(
      panel('p1', ['v1', 'v2']),
      'p1',
      'row',
      panel('p2'),
    )
    const result = moveViewToPanel(split, 'v2', 'p2')
    const homes = panels(result).filter(p => p.viewIds.includes('v2'))
    expect(homes.map(p => p.id)).toEqual(['p2'])
    expect(
      panels(result)
        .flatMap(p => p.viewIds)
        .sort(),
    ).toEqual(['v1', 'v2'])
  })

  test('adding a view twice is a no-op', () => {
    const once = addViewToPanel(panel('p1'), 'p1', 'v1')
    expect(addViewToPanel(once, 'p1', 'v1')).toEqual(once)
  })

  test('removing a view leaves its panel standing', () => {
    const result = removeView(panel('p1', ['v1']), 'v1')
    expect(result.id).toBe('p1')
    expect((result as PanelNode).viewIds).toEqual([])
  })
})

// The operations are total: any sequence of them, from any starting tree, ends
// canonical. This is the property the imperative bridge could not have, because
// there "canonical" depended on what dockview did in response.
test('any sequence of operations leaves a canonical tree', () => {
  let tree: LayoutTree = panel('p0', ['v0'])
  let n = 0
  const rng = mulberry32(20260812)

  for (let step = 0; step < 2000; step++) {
    const ids = panels(tree).map(p => p.id)
    const target = ids[Math.floor(rng() * ids.length)]!
    const roll = rng()
    if (roll < 0.4) {
      n++
      tree = splitPanel(
        tree,
        target,
        rng() < 0.5 ? 'row' : 'column',
        panel(`p${n}`, [`v${n}`]),
        rng() < 0.5,
      )
    } else if (roll < 0.7 && ids.length > 1) {
      tree = removePanel(tree, target)
    } else if (roll < 0.85) {
      const views = panels(tree).flatMap(p => p.viewIds)
      const view = views[Math.floor(rng() * views.length)]
      if (view) {
        tree = moveViewToPanel(tree, view, target)
      }
    } else if (isBranch(tree)) {
      tree = setSizes(
        tree,
        tree.id,
        tree.children.map(() => rng() + 0.01),
      )
    }
    expectCanonical(tree)
    // no view is ever duplicated or stranded
    const all = panels(tree).flatMap(p => p.viewIds)
    expect(new Set(all).size).toBe(all.length)
  }
})

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
