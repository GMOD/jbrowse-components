import { fireEvent, render } from '@testing-library/react'

import { ClusterProvenanceHint } from './ClusterProvenanceHint.tsx'
import { clusterProvenanceFromRegions } from './clusterProvenance.ts'

import type { ClusterProvenanceRegion } from './clusterProvenance.ts'
import type { TreeSidebarModel } from './types.ts'

// Partial mock: the hint reads the containing view for the blocks on screen,
// but `clusterProvenance.ts` still needs the real `assembleLocString` to build
// the label this is asserting on.
let mockVisibleBlocks: ClusterProvenanceRegion[] = []
jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual('@jbrowse/core/util'),
  getContainingView: () => ({
    dynamicBlocks: {
      get contentBlocks() {
        return mockVisibleBlocks
      },
    },
  }),
}))

const CLUSTERED_AT = { refName: 'ctgA', start: 1000, end: 2000 }

// Only the slice the hint reads; the rest of TreeSidebarModel is the sidebar's
// canvas plumbing. `hierarchy` stands in for a positioned tree — the hint gates
// on the tree actually being drawn.
function model(props: Partial<TreeSidebarModel>) {
  return {
    showTree: true,
    hierarchy: { x: 0, y: 0 } as never,
    treeAreaWidth: 80,
    height: 100,
    setTreeCanvasRef: () => {},
    setMouseoverCanvasRef: () => {},
    setHoveredTreeNode: () => {},
    setTreeAreaWidth: () => {},
    setSubtreeFilter: () => {},
    clusterProvenance: clusterProvenanceFromRegions([CLUSTERED_AT]),
    ...props,
  } as TreeSidebarModel
}

function draw(props: Partial<TreeSidebarModel> = {}) {
  const view = render(<ClusterProvenanceHint model={model(props)} />)
  return { view, chip: view.queryByTestId('cluster_provenance_hint') }
}

beforeEach(() => {
  mockVisibleBlocks = [CLUSTERED_AT]
})

describe('ClusterProvenanceHint', () => {
  it('names the locus the tree was computed from', () => {
    expect(draw().chip?.textContent).toBe('ctgA:1,001..2,000')
  })

  it('carries the settings in the tooltip, where there is room for them', () => {
    const { chip } = draw({
      clusterProvenance: clusterProvenanceFromRegions(
        [CLUSTERED_AT],
        [{ name: 'MAF filter', value: '0.05' }],
      ),
    })
    expect(chip?.getAttribute('title')).toContain(
      'Clustered on ctgA:1,001..2,000 · MAF filter: 0.05',
    )
  })

  // A tree that arrives as data (maf's `.nh` phylogeny) records no locus, and
  // captioning it with one would be a claim the tree does not make.
  it('says nothing for a tree with no provenance', () => {
    expect(draw({ clusterProvenance: undefined }).chip).toBeNull()
  })

  // The tree is what the caption describes, so with no tree drawn there is
  // nothing to caption — `StaleTreeHint` owns explaining that case.
  it('says nothing when the tree is not being drawn', () => {
    const unpositioned = draw({ hierarchy: undefined })
    expect(unpositioned.chip).toBeNull()
    unpositioned.view.unmount()
    expect(draw({ showTree: false }).chip).toBeNull()
  })

  describe('drift', () => {
    it('stays quiet while the clustered region is still in view', () => {
      const { chip } = draw()
      expect(chip?.textContent).not.toContain('⚠')
      expect(chip?.getAttribute('title')).toContain(
        'Clustering reads only the region in view',
      )
    })

    // The point of the whole component: row names don't change when you pan, so
    // the dendrogram stays drawn over a locus it was never computed at.
    it('marks the chip once the view has moved off the clustered region', () => {
      mockVisibleBlocks = [{ refName: 'ctgB', start: 1000, end: 2000 }]
      const { chip } = draw()
      expect(chip?.textContent).toContain('⚠')
      expect(chip?.getAttribute('title')).toContain(
        'this tree does not describe what is on screen',
      )
    })

    // Ordinary panning and zooming inside the clustered locus must not trip it,
    // or the warning becomes noise and stops being read.
    it('does not mark a nudge or a zoom-out', () => {
      mockVisibleBlocks = [{ refName: 'ctgA', start: 1001, end: 2001 }]
      const nudged = draw()
      expect(nudged.chip?.textContent).not.toContain('⚠')
      // both renders share document.body, so the first has to go before the
      // second is queried for
      nudged.view.unmount()
      mockVisibleBlocks = [{ refName: 'ctgA', start: 0, end: 9000 }]
      expect(draw().chip?.textContent).not.toContain('⚠')
    })
  })

  // It overlaps the first row's label, so it can be dismissed — but the locus is
  // a property of the tree rather than a notification, so dismissal is local
  // state and the chip returns on remount.
  it('dismisses on click and comes back on remount', () => {
    const { view, chip } = draw()
    fireEvent.click(chip!)
    expect(view.queryByTestId('cluster_provenance_hint')).toBeNull()
    view.unmount()
    expect(draw().chip).not.toBeNull()
  })
})
