import { TrackOverlayContext } from '@jbrowse/display-ui'
import { render } from '@testing-library/react'

import TreeSidebar from './TreeSidebar.tsx'
import { buildTree } from './clusterUtils.ts'

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
    setTreeCanvasRef: () => {},
    setMouseoverCanvasRef: () => {},
    setHoveredTreeNode: () => {},
    setTreeAreaWidth: () => {},
    setSubtreeFilter: () => {},
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
// cares about (and what regressed: maf's `top` and the canvas's own `top` used
// to both carry the full `rowsTopOffset`).
function renderedTop(el: HTMLElement) {
  const own = Number.parseFloat(el.style.top || '0')
  const parent = el.parentElement
  const ancestor = parent ? Number.parseFloat(parent.style.top || '0') : 0
  return own + ancestor
}

describe('TreeSidebar', () => {
  // maf is the only caller that passes `top`: its inline hit-test layer already
  // sits inside a container translated by `rowsTopOffset` (its wheel listener is
  // bound to that container by DOM node, see the package CLAUDE.md), and its
  // portaled canvas layer escapes that container through the portal — both are
  // *already* offset by the time they reach here, once via the ancestor and
  // once via `top` standing in for it. Adding `rowsTopOffset` again on top, as
  // every other caller's un-offset layers need, pushed the dendrogram an extra
  // `rowsTopOffset` px down the track — worse the deeper the band stack (maf's
  // conservation band stacks on top of its coverage band).
  it('does not add rowsTopOffset again when the caller already passed it as top', () => {
    const { getByTestId } = draw({ rowsTopOffset: 85 }, 85)
    expect(renderedTop(getByTestId('tree_sidebar_dendrogram'))).toBe(85)
  })

  // The default caller (variants, multi-wiggle, multi-row) renders the sidebar
  // unnested and passes no `top`, so the full offset has to come from here.
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
})
