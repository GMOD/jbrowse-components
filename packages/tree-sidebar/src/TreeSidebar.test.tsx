import { TrackOverlayContext } from '@jbrowse/display-ui'
import { render } from '@testing-library/react'

import TreeSidebar from './TreeSidebar.tsx'
import { buildTree } from './clusterUtils.ts'
import { SIDEBAR_HINT_LINE_PX } from './treeSidebarGeometry.ts'

import type { TreeSidebarModel } from './types.ts'

jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual('@jbrowse/core/util'),
  getContainingView: () => ({
    width: 400,
    dynamicBlocks: { contentBlocks: [] },
  }),
}))

const rows = [{ name: 'a' }, { name: 'b' }]

// Only the slice TreeSidebar reads; the rest is the canvas-drawing autorun's.
function model(props: Partial<TreeSidebarModel> = {}): TreeSidebarModel {
  return {
    showTree: true,
    sources: rows,
    hierarchy: { x: 0, y: 0 } as never,
    root: buildTree('(a,b);'),
    treeAreaWidth: 80,
    height: 200,
    rowsTopOffset: 0,
    rowFocusLineHeight: 0,
    setTreeCanvasRef: () => {},
    setMouseoverCanvasRef: () => {},
    setHoveredTreeNode: () => {},
    setTreeAreaWidth: () => {},
    setRowFocus: () => {},
    setScrollTop: () => {},
    ...props,
  }
}

function draw(props: Partial<TreeSidebarModel>, top?: number) {
  return render(
    <TrackOverlayContext value={null}>
      <TreeSidebar model={model(props)} top={top} />
    </TrackOverlayContext>,
  )
}

// `top`, the prop, lands on the `GutterLayer` div wrapping the canvas — the
// canvas's own `top` style is only the remainder left to apply on top of that.
// The rendered position is their sum, which is what every caller actually
// cares about (and what regressed: the caller's `top` and the canvas's own `top`
// used to both carry the full `rowsTopOffset`).
function renderedTop(el: HTMLElement) {
  const own = Number.parseFloat(el.style.top || '0')
  const parent = el.parentElement
  const ancestor = parent ? Number.parseFloat(parent.style.top || '0') : 0
  return own + ancestor
}

describe('TreeSidebar', () => {
  // `RowsPanel` passes `top`: its inline layer already sits in the panel
  // translated by `rowsTopOffset`, and `top` stands in for that ancestor on
  // the portaled layer. Adding `rowsTopOffset` again pushed the dendrogram an
  // extra `rowsTopOffset` px down the track.
  it('does not add rowsTopOffset again when the caller already passed it as top', () => {
    const { getByTestId } = draw({ rowsTopOffset: 85 }, 85)
    expect(renderedTop(getByTestId('tree_sidebar_dendrogram'))).toBe(85)
  })

  // Wiggle and multi-row render the sidebar unnested and pass no `top`, so the
  // full offset has to come from here.
  it('applies rowsTopOffset itself when the caller passes no top', () => {
    const { getByTestId } = draw({ rowsTopOffset: 40 })
    expect(renderedTop(getByTestId('tree_sidebar_dendrogram'))).toBe(40)
  })

  it('sits at 0 when nothing is reserved above the rows', () => {
    const { getByTestId } = draw({})
    expect(renderedTop(getByTestId('tree_sidebar_dendrogram'))).toBe(0)
  })

  // The stale-tree hint takes the same early-return path and is subject to the
  // same arithmetic — it sits over the rows' own space, not the doubled one.
  it('keeps the stale-tree hint off the doubled offset too', () => {
    const { getByTestId } = draw(
      {
        hierarchy: undefined,
        root: buildTree('((a,b),c);'),
        rowsTopOffset: 85,
      },
      85,
    )
    expect(renderedTop(getByTestId('stale_tree_hint'))).toBe(85)
  })

  // The focus chip sits in its own line, so the first row's label stays
  // readable under a chip whose only click clears the focus.
  it('puts the focus chip in the line above the rows, and the tree under it', () => {
    const { getByTestId } = draw(
      {
        rowFocus: ['a', 'b'],
        rowsTopOffset: 85 + SIDEBAR_HINT_LINE_PX,
        rowFocusLineHeight: SIDEBAR_HINT_LINE_PX,
      },
      85,
    )
    const chip = getByTestId('row_focus_hint')
    expect(renderedTop(chip)).toBe(85)
    expect(renderedTop(chip) + SIDEBAR_HINT_LINE_PX).toBe(
      renderedTop(getByTestId('tree_sidebar_dendrogram')),
    )
  })
})
