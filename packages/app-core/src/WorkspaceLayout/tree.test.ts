import {
  addTab,
  addViewToTab,
  isBranch,
  moveTabToPanel,
  normalize,
  panels,
  removePanel,
  removeTab,
  removeView,
  setSizes,
  splitPanel,
  tabs,
} from './tree.ts'

import type { LayoutTree, PanelNode } from './tree.ts'

// one tab per panel unless a test says otherwise, since the tab level is
// orthogonal to every structural rule below
let seq = 0
function panel(id: string, viewIds: string[] = [], size = 1): PanelNode {
  seq += 1
  const tabId = `${id}-tab${seq}`
  return { id, size, tabs: [{ id: tabId, viewIds }], activeTabId: tabId }
}
function tabIdOf(node: LayoutTree, panelId: string) {
  return panels(node).find(p => p.id === panelId)!.tabs[0]!.id
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

  test('an empty tab survives — it is what a new empty tab is', () => {
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
    expect((result as PanelNode).tabs).toEqual([])
  })
})

describe('views and tabs', () => {
  test('a tab moves atomically — never in two panels, never in none', () => {
    const split = splitPanel(panel('p1', ['v1']), 'p1', 'row', panel('p2'))
    const movedTab = tabIdOf(split, 'p1')
    const result = moveTabToPanel(split, movedTab, 'p2')

    const homes = panels(result).filter(p =>
      p.tabs.some(t => t.id === movedTab),
    )
    expect(homes.map(p => p.id)).toEqual(['p2'])
    expect(tabs(result).flatMap(t => t.viewIds)).toEqual(['v1'])
  })

  test('a moved tab becomes the active one in its new panel', () => {
    const split = splitPanel(panel('p1', ['v1']), 'p1', 'row', panel('p2'))
    const movedTab = tabIdOf(split, 'p1')
    const result = moveTabToPanel(split, movedTab, 'p2')
    const target = panels(result).find(p => p.id === 'p2')!
    expect(target.activeTabId).toBe(movedTab)
  })

  // `index` counts the strip the USER is looking at, which is the tree before
  // the move. Within one panel that differs from the post-removal ordering
  // exactly when the tab starts to the left of the gap it was dropped in, and
  // getting it wrong lands the tab one place too far right — the classic
  // remove-then-insert off-by-one, and invisible until a UI passed an index.
  describe('reordering within one panel', () => {
    const threeTabs = (): PanelNode => ({
      id: 'p1',
      size: 1,
      tabs: [
        { id: 'a', viewIds: ['v1'] },
        { id: 'b', viewIds: ['v2'] },
        { id: 'c', viewIds: ['v3'] },
      ],
      activeTabId: 'a',
    })
    const order = (tree: LayoutTree) => (tree as PanelNode).tabs.map(t => t.id)

    test('a tab dragged rightwards lands in the gap it was dropped in', () => {
      // the gap between b and c is index 2 on screen
      expect(order(moveTabToPanel(threeTabs(), 'a', 'p1', 2))).toEqual([
        'b',
        'a',
        'c',
      ])
    })

    test('a tab dragged leftwards needs no adjustment', () => {
      expect(order(moveTabToPanel(threeTabs(), 'c', 'p1', 1))).toEqual([
        'a',
        'c',
        'b',
      ])
    })

    test('dropping a tab in its own gap leaves the order alone', () => {
      expect(order(moveTabToPanel(threeTabs(), 'b', 'p1', 1))).toEqual([
        'a',
        'b',
        'c',
      ])
      expect(order(moveTabToPanel(threeTabs(), 'b', 'p1', 2))).toEqual([
        'a',
        'b',
        'c',
      ])
    })

    test('the ends are reachable', () => {
      expect(order(moveTabToPanel(threeTabs(), 'c', 'p1', 0))).toEqual([
        'c',
        'a',
        'b',
      ])
      expect(order(moveTabToPanel(threeTabs(), 'a', 'p1', 3))).toEqual([
        'b',
        'c',
        'a',
      ])
    })

    test('an index past the end clamps rather than leaving a hole', () => {
      expect(order(moveTabToPanel(threeTabs(), 'a', 'p1', 99))).toEqual([
        'b',
        'c',
        'a',
      ])
      expect(order(moveTabToPanel(threeTabs(), 'a', 'p1', -5))).toEqual([
        'a',
        'b',
        'c',
      ])
    })

    // Across panels there is no shift: removing the tab does not disturb the
    // target's ordering, so the index means what it says.
    test('moving into another panel inserts at the index as given', () => {
      const split = splitPanel(threeTabs(), 'p1', 'row', {
        id: 'p2',
        size: 1,
        tabs: [
          { id: 'x', viewIds: ['v4'] },
          { id: 'y', viewIds: ['v5'] },
        ],
        activeTabId: 'x',
      })
      const result = moveTabToPanel(split, 'a', 'p2', 1)
      const target = panels(result).find(p => p.id === 'p2')!
      expect(target.tabs.map(t => t.id)).toEqual(['x', 'a', 'y'])
    })
  })

  test('adding a view twice is a no-op', () => {
    const base = panel('p1')
    const tabId = base.tabs[0]!.id
    const once = addViewToTab(base, tabId, 'v1')
    expect(addViewToTab(once, tabId, 'v1')).toEqual(once)
  })

  test('removing a view leaves its tab standing', () => {
    const result = removeView(panel('p1', ['v1']), 'v1')
    expect(result.id).toBe('p1')
    expect((result as PanelNode).tabs[0]!.viewIds).toEqual([])
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
      const all = tabs(tree)
      const tab = all[Math.floor(rng() * all.length)]
      if (tab) {
        tree = moveTabToPanel(tree, tab.id, target)
      }
    } else if (isBranch(tree)) {
      tree = setSizes(
        tree,
        tree.id,
        tree.children.map(() => rng() + 0.01),
      )
    }
    expectCanonical(tree)
    // no view and no tab is ever duplicated or stranded
    const allViews = tabs(tree).flatMap(t => t.viewIds)
    expect(new Set(allViews).size).toBe(allViews.length)
    const allTabs = tabs(tree).map(t => t.id)
    expect(new Set(allTabs).size).toBe(allTabs.length)
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

// The pure functions are exported and callable directly, so each has to be
// total on its own — a guard in the MST action above it protects that caller
// and nobody else. `moveTabToPanel` takes the tab out before putting it back,
// which makes a missing target a silent deletion rather than a no-op.
describe('operations are total on bad arguments', () => {
  const base = splitPanel(panel('p1', ['v1']), 'p1', 'row', panel('p2'))

  test('moving to a panel that is not there changes nothing', () => {
    const tabId = tabIdOf(base, 'p1')
    const result = moveTabToPanel(base, tabId, 'nope')
    expect(result).toEqual(base)
    expect(tabs(result).flatMap(t => t.viewIds)).toEqual(['v1'])
  })

  test('moving a tab that is not there changes nothing', () => {
    expect(moveTabToPanel(base, 'nope', 'p2')).toEqual(base)
  })

  test('splitting, removing and adding against a missing id are no-ops', () => {
    expect(splitPanel(base, 'nope', 'row', panel('p9'))).toEqual(base)
    expect(removePanel(base, 'nope')).toEqual(base)
    expect(addTab(base, 'nope', { id: 't9', viewIds: [] })).toEqual(base)
    expect(removeTab(base, 'nope')).toEqual(base)
    expect(setSizes(base, 'nope', [0.5, 0.5])).toEqual(base)
    expect(addViewToTab(base, 'nope', 'v9')).toEqual(base)
    expect(removeView(base, 'nope')).toEqual(base)
  })
})
