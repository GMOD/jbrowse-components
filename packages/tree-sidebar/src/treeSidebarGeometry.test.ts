import {
  TREE_RESIZE_HANDLE_WIDTH,
  treeContentHeight,
  treeIsShowing,
  treeSidebarOffset,
  treeSidebarRightEdge,
} from './treeSidebarGeometry.ts'

// One gate decides three things that must never disagree: whether `TreeSidebar`
// paints, whether the row labels beside it are pushed right to clear it, and
// whether the mouse guides stop short of it. Each used to spell it out.
describe('treeIsShowing', () => {
  const hierarchy = {}

  it('is the positioned tree AND the toggle', () => {
    expect(treeIsShowing({ showTree: true, hierarchy })).toBe(true)
    expect(treeIsShowing({ showTree: false, hierarchy })).toBe(false)
  })

  // Gating on `clusterTree` instead reserved a gutter with nothing in it: a
  // tree that no longer describes the rows on screen is deliberately not
  // positioned, and for a display that regroups `sources` downstream of
  // `layout` that state is permanent rather than transient.
  it('is false with a tree that could not be positioned', () => {
    expect(treeIsShowing({ showTree: true, hierarchy: undefined })).toBe(false)
  })
})

describe('treeSidebarOffset', () => {
  it('reserves the sidebar width only when the tree is showing', () => {
    expect(
      treeSidebarOffset({ showTree: true, hierarchy: {}, treeAreaWidth: 80 }),
    ).toBe(80)
    expect(
      treeSidebarOffset({
        showTree: true,
        hierarchy: undefined,
        treeAreaWidth: 80,
      }),
    ).toBe(0)
    expect(
      treeSidebarOffset({ showTree: false, hierarchy: {}, treeAreaWidth: 80 }),
    ).toBe(0)
  })
})

describe('treeSidebarRightEdge', () => {
  it('includes the resize handle, and is 0 with no tree', () => {
    expect(
      treeSidebarRightEdge({
        showTree: true,
        hierarchy: {},
        treeAreaWidth: 80,
      }),
    ).toBe(80 + TREE_RESIZE_HANDLE_WIDTH)
    expect(
      treeSidebarRightEdge({
        showTree: false,
        hierarchy: {},
        treeAreaWidth: 80,
      }),
    ).toBe(0)
  })
})

describe('treeContentHeight', () => {
  it('subtracts the reserved line zone, defaulting it to 0', () => {
    expect(treeContentHeight({ height: 100, lineZoneHeight: 20 })).toBe(80)
    expect(treeContentHeight({ height: 100 })).toBe(100)
  })
})
