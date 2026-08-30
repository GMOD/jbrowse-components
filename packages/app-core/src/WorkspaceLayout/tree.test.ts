import {
  addTab,
  addViewToTab,
  homeViews,
  isBranch,
  moveTabToPanel,
  normalize,
  panels,
  pruneEmptyPanel,
  pruneEmptyTabIn,
  removePanel,
  removeTab,
  removeView,
  renameTab,
  setActiveTab,
  setSizes,
  splitPanel,
  tabs,
} from './tree.ts'

import type { BranchNode, LayoutTree, PanelNode } from './tree.ts'

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
// Walks first and asserts once, rather than asserting per node. The 2000-step
// sequence below calls this on a tree that grows as it goes, so an `expect` per
// branch made the run quadratic — ~1.4M assertions, 25 of the suite's 29
// seconds. Returning the offender also names it, which a bare
// `expect(child.size).toBeGreaterThan(0)` two hundred nodes deep never did.
function canonicalViolation(node: LayoutTree): string | undefined {
  if (!isBranch(node)) {
    return undefined
  }
  if (node.children.length <= 1) {
    return `branch ${node.id} has ${node.children.length} children`
  }
  const total = node.children.reduce((sum, c) => sum + c.size, 0)
  // toBeCloseTo(1, 6)'s own threshold
  if (Math.abs(total - 1) >= 5e-7) {
    return `branch ${node.id} sizes sum to ${total}`
  }
  for (const child of node.children) {
    if (!(child.size > 0)) {
      return `${child.id} in ${node.id} has size ${child.size}`
    }
    if (isBranch(child) && child.direction === node.direction) {
      return `${child.id} nests ${child.direction} inside ${node.id}`
    }
    const deeper = canonicalViolation(child)
    if (deeper !== undefined) {
      return deeper
    }
  }
  return undefined
}

function expectCanonical(node: LayoutTree) {
  expect(canonicalViolation(node)).toBeUndefined()
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

  // ...including in floating point, which is the half that was not true.
  // Dividing by a sum of 1 and multiplying by 1 is not the identity for most
  // pane counts, and normalisation runs on EVERY action — so an equal split of
  // six or more panes oscillated between two size vectors forever, and every
  // action on a settled layout wrote a snapshot in which nothing had changed.
  test('is idempotent for an equal split of any size', () => {
    for (const count of [2, 3, 5, 6, 7, 11, 19, 24]) {
      const once = normalize({
        id: 'root',
        size: 1,
        direction: 'row',
        children: Array.from({ length: count }, (_, i) => panel(`p${i}`)),
      })
      expect(normalize(once)).toEqual(once)
    }
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

    // The shift is about reading a STATED index against the strip on screen, so
    // it must not touch the no-index case: a caller that states nothing is not
    // describing a gap. Dropping a tab on its own panel's BODY takes this path,
    // and the shift landed it one place short of the end.
    test('no index appends, even when the tab is already in that panel', () => {
      expect(order(moveTabToPanel(threeTabs(), 'a', 'p1'))).toEqual([
        'b',
        'c',
        'a',
      ])
      expect(order(moveTabToPanel(threeTabs(), 'b', 'p1'))).toEqual([
        'a',
        'c',
        'b',
      ])
      // and the tab that was already last stays last
      expect(order(moveTabToPanel(threeTabs(), 'c', 'p1'))).toEqual([
        'a',
        'b',
        'c',
      ])
    })

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
//
// Every operation the tree has is in the mix, `homeViews` included — it runs on
// every change to `session.views` and used to sit in the model, which is to say
// outside the one test that drives operations against each other. The
// interesting sequences are the ones where it follows a removal.
test('any sequence of operations leaves a canonical tree', () => {
  let tree: LayoutTree = panel('p0', ['v0'])
  let n = 0
  const rng = mulberry32(20260812)
  function pick<T>(items: T[]): T | undefined {
    return items[Math.floor(rng() * items.length)]
  }

  for (let step = 0; step < 2000; step++) {
    const ids = panels(tree).map(p => p.id)
    const target = pick(ids)!
    const someTab = pick(tabs(tree))
    const roll = rng()
    if (roll < 0.3) {
      n++
      tree = splitPanel(
        tree,
        target,
        rng() < 0.5 ? 'row' : 'column',
        panel(`p${n}`, [`v${n}`]),
        rng() < 0.5,
      )
    } else if (roll < 0.5 && ids.length > 1) {
      tree = removePanel(tree, target)
    } else if (roll < 0.65 && someTab) {
      // With an index as well as without: driving it with none left the index
      // shift — the fiddliest arithmetic in the file — outside the sequence.
      // The assertion states the reading rather than reproducing the shift,
      // which would prove nothing: whatever was left of the gap on screen is
      // what ends up left of the tab, minus the tab itself.
      const into = panels(tree).find(p => p.id === target)!
      const onScreen = into.tabs.map(t => t.id)
      // half of them a REORDER, the only case the shift applies to — picked
      // from the whole tree it was 5 of 160, which samples nothing
      const moving = (rng() < 0.5 ? pick(into.tabs) : undefined) ?? someTab
      const at =
        rng() < 0.5 ? undefined : Math.floor(rng() * (onScreen.length + 1))
      tree = moveTabToPanel(tree, moving.id, target, at)
      if (at !== undefined) {
        const landed = panels(tree)
          .find(p => p.id === target)!
          .tabs.map(t => t.id)
        expect(landed.slice(0, landed.indexOf(moving.id))).toEqual(
          onScreen.slice(0, at).filter(id => id !== moving.id),
        )
      }
    } else if (roll < 0.72) {
      n++
      tree = addTab(tree, target, { id: `t${n}`, viewIds: [`v${n}`] })
    } else if (roll < 0.79 && someTab) {
      tree = removeTab(tree, someTab.id)
    } else if (roll < 0.86 && someTab) {
      tree = setActiveTab(tree, target, someTab.id)
    } else if (roll < 0.86) {
      // homing against a list that has drifted from the tree in both
      // directions: some views it does not know about, some it has lost
      const held = tabs(tree).flatMap(t => t.viewIds)
      n++
      const session = [...held.filter(() => rng() < 0.8), `v${n}`]
      tree = homeViews(tree, session, pick(ids), () => `t-home${step}`)
    } else if (roll < 0.89) {
      tree = renameTab(
        tree,
        someTab?.id ?? 'nope',
        rng() < 0.5 ? 'Named' : undefined,
      )
    } else if (roll < 0.93) {
      // the two prunes are the gesture-level operations, and the ones with a
      // "unless it is the last" guard to get wrong. Driven standalone rather
      // than only after the move that empties something, because they are
      // exported and total like the rest
      tree = pruneEmptyPanel(tree, target)
    } else if (roll < 0.96 && someTab) {
      tree = pruneEmptyTabIn(tree, target, someTab.id)
    } else {
      // any branch, not just the root: rule 3 rescales a flattened branch's
      // children to the share it held, so a nested one just resized is the
      // input that exercises that arithmetic
      const branch = pick(branchesIn(tree))
      if (branch) {
        tree = setSizes(
          tree,
          branch.id,
          branch.children.map(() => rng() + 0.01),
        )
      }
    }
    expectCanonical(tree)
    // canonical AND settled: normalising again must change nothing at all.
    // `expectCanonical` alone cannot see this — it asserts the sizes sum to 1
    // to six places, which every step of an oscillation does.
    expect(normalize(tree)).toEqual(tree)
    // no view and no tab is ever duplicated or stranded
    const allViews = tabs(tree).flatMap(t => t.viewIds)
    expect(new Set(allViews).size).toBe(allViews.length)
    const allTabs = tabs(tree).map(t => t.id)
    expect(new Set(allTabs).size).toBe(allTabs.length)
    // and a panel never shows a tab it does not have. `activeTabId` is a
    // `maybe` naming a sibling, so nothing structural enforces this — every
    // operation that can retire a tab has to hand it on.
    const orphanedActive = panels(tree).find(
      p =>
        p.activeTabId !== undefined &&
        !p.tabs.some(t => t.id === p.activeTabId),
    )
    expect(orphanedActive).toBeUndefined()
  }
})

// there are no parent pointers, so a branch is found by walking rather than by
// asking one — the same reason `panels` exists
function branchesIn(node: LayoutTree): BranchNode[] {
  return isBranch(node) ? [node, ...node.children.flatMap(branchesIn)] : []
}

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
