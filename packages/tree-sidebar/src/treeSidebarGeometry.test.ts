import {
  MIN_TREE_AREA_WIDTH,
  TREE_RESIZE_HANDLE_WIDTH,
  clampTreeAreaWidth,
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

// The gutter's resize handle sits at `left: treeAreaWidth` INSIDE the display,
// which renders in `TrackRenderingContainer`'s `contain: strict` sandbox. So a
// drag that took the gutter past the view width put the handle outside that
// box, where it is clipped away and cannot be clicked — and `treeAreaWidth` is
// persisted with no menu item to reset it, so the track came back all-sidebar
// after a reload. The drag carried `Math.max(10, …)` and nothing on the other
// side.
describe('clampTreeAreaWidth', () => {
  const VIEW = 800

  it('leaves an ordinary width alone', () => {
    expect(clampTreeAreaWidth(80, VIEW)).toBe(80)
  })

  // The invariant, stated as the thing that was broken: whatever the drag asks
  // for, the control that got you there is still on screen.
  it('keeps the handle reachable at any drag distance', () => {
    for (const width of [795, 800, 5000]) {
      expect(
        clampTreeAreaWidth(width, VIEW) + TREE_RESIZE_HANDLE_WIDTH,
      ).toBeLessThanOrEqual(VIEW)
    }
  })

  it('still holds the existing floor', () => {
    expect(clampTreeAreaWidth(0, VIEW)).toBe(MIN_TREE_AREA_WIDTH)
    expect(clampTreeAreaWidth(-500, VIEW)).toBe(MIN_TREE_AREA_WIDTH)
  })

  // A viewport too narrow to satisfy both: the floor wins, because a sidebar
  // you cannot see is the lesser problem of the two.
  it('prefers the floor on a viewport narrower than it', () => {
    expect(clampTreeAreaWidth(80, 8)).toBe(MIN_TREE_AREA_WIDTH)
  })
})
