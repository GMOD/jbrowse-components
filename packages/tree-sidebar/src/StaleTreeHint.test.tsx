import { fireEvent, render } from '@testing-library/react'

import { StaleTreeHint } from './StaleTreeHint.tsx'
import { buildTree } from './clusterUtils.ts'

import type { TreeSidebarModel } from './types.ts'

const rows = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]

// Only the slice the hint reads; the rest of TreeSidebarModel is the sidebar's
// canvas plumbing.
function model(props: Partial<TreeSidebarModel>): TreeSidebarModel {
  return {
    showTree: true,
    sources: rows,
    treeAreaWidth: 80,
    height: 100,
    setTreeCanvasRef: () => {},
    setMouseoverCanvasRef: () => {},
    setHoveredTreeNode: () => {},
    setTreeAreaWidth: () => {},
    setSubtreeFilter: () => {},
    ...props,
  }
}

function draw(props: Partial<TreeSidebarModel>) {
  const view = render(<StaleTreeHint model={model(props)} />)
  return view.queryByTestId('stale_tree_hint')
}

function drawWithView(props: Partial<TreeSidebarModel>) {
  const view = render(<StaleTreeHint model={model(props)} />)
  return { view, hint: view.queryByTestId('stale_tree_hint') }
}

describe('StaleTreeHint', () => {
  it('shows when a tree exists but does not describe the rows', () => {
    expect(draw({ root: buildTree('((c,a),b);') })).not.toBeNull()
  })

  it('stays silent when there is no tree at all', () => {
    expect(draw({})).toBeNull()
  })

  // The tree is positioned, so nothing is hidden and there is nothing to say.
  it('stays silent when the tree describes the rows', () => {
    expect(
      draw({
        root: buildTree('((a,b),c);'),
        hierarchy: { x: 0, y: 0 } as never,
      }),
    ).toBeNull()
  })

  // Multi-wiggle's overlay modes drop `hierarchy` deliberately, having no row
  // axis for a dendrogram to align to — that is not staleness.
  it('stays silent when the tree matches but is not being positioned', () => {
    expect(draw({ root: buildTree('((a,b),c);') })).toBeNull()
  })

  it('stays silent while the sidebar is hidden', () => {
    expect(draw({ root: buildTree('((c,a),b);'), showTree: false })).toBeNull()
  })

  // `rowsTopOffset` is the band a display reserves above its rows (the variants
  // matrix display's connector zone, which the user can drag arbitrarily tall).
  // At top:0 the hint floated that far above the rows it is describing, while
  // every other thing the sidebar paints — including its sibling
  // `ClusterProvenanceHint` — starts at the same offset.
  it('sits at the top of the rows, not of the line zone above them', () => {
    const { getByTestId } = render(
      <StaleTreeHint
        model={model({ root: buildTree('((c,a),b);') })}
        top={40}
      />,
    )
    expect(getByTestId('stale_tree_hint').style.top).toBe('40px')
  })

  it('can be dismissed, since one display holds this state permanently', () => {
    const { view, hint } = drawWithView({ root: buildTree('((c,a),b);') })
    fireEvent.click(hint!)
    expect(view.queryByTestId('stale_tree_hint')).toBeNull()
  })

  // It sits over a row's own label, so getting rid of it must not require a
  // mouse. A button rather than a clickable div is what puts it in the tab order
  // and makes Enter and Space dismiss it, which jsdom does not simulate.
  it('is a button, so the keyboard can dismiss it too', () => {
    const { hint } = drawWithView({ root: buildTree('((c,a),b);') })
    expect(hint!.tagName).toBe('BUTTON')
    hint!.focus()
    expect(document.activeElement).toBe(hint)
  })
})
