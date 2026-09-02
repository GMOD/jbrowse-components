import { clusterProvenanceFromRegions } from './clusterProvenance.ts'
import {
  clusterProvenanceMenuItems,
  clusteringMenuItem,
  resetRowOrderMenuItems,
} from './treeMenuItems.ts'

const CLUSTERED_AT = { refName: 'ctgA', start: 1000, end: 2000 }

// `ClusterProvenanceHint` draws only when the view has drifted off the
// clustered span, so this menu item is the only route to the locus in the
// ordinary case. If it ever silently returns nothing, a dendrogram beside the
// wrong locus looks exactly like one beside the right locus and there is no
// longer anywhere to check.
describe('clusterProvenanceMenuItems', () => {
  it('names the locus the tree was computed from', () => {
    const [item] = clusterProvenanceMenuItems({
      clusterProvenance: clusterProvenanceFromRegions([CLUSTERED_AT]),
    })
    expect(item).toMatchObject({
      label: 'Clustered on ctgA:1,001..2,000',
      disabled: true,
    })
  })

  it('carries the run settings alongside the locus', () => {
    const [item] = clusterProvenanceMenuItems({
      clusterProvenance: clusterProvenanceFromRegions(
        [CLUSTERED_AT],
        [{ name: 'MAF filter', value: '0.05' }],
      ),
    })
    expect(item).toMatchObject({
      label: 'Clustered on ctgA:1,001..2,000 · MAF filter: 0.05',
    })
  })

  // A supplied phylogeny (maf's `.nh`) records no locus, and captioning it with
  // one would be a claim the tree does not make. Spread, so this is an empty
  // list rather than a disabled placeholder.
  it('contributes nothing for a tree that was not computed here', () => {
    expect(clusterProvenanceMenuItems({})).toEqual([])
  })
})

// Four menus across four displays spread this one item — multi-wiggle's track
// and context menus, multi-row features' pair, the two multi-sample variant
// menus, and maf's. They used to spell it out each, held together by comments
// asserting they were one action.
describe('resetRowOrderMenuItems', () => {
  it('offers the reset once a row order has been written', () => {
    const clearLayout = jest.fn()
    const [item] = resetRowOrderMenuItems({
      rowOrderIsCustom: true,
      clearLayout,
    })

    expect(item).toMatchObject({ label: 'Reset row order' })
    if (item && 'onClick' in item) {
      item.onClick()
    }
    expect(clearLayout).toHaveBeenCalled()
  })

  // Gated on `layout`, not on `clusterTree`: a clustering run is only one of the
  // things that writes the order — the arrangement dialog and the right-click
  // sorts write it with no tree at all, and this is what undoes those too.
  it('contributes nothing while the rows are in discovered order', () => {
    expect(
      resetRowOrderMenuItems({
        rowOrderIsCustom: false,
        clearLayout: jest.fn(),
      }),
    ).toEqual([])
  })
})

// The "needs two rows" rule is stated a dozen times across the four displays'
// menus, dialogs, autorun gates and run functions, and two of those spellings
// let one row through. Passing `rowCount` moves the menu half of it here.
describe('clusteringMenuItem', () => {
  const runItem = { label: 'Cluster rows by score...', onClick: () => {} }
  const model = { setSubtreeFilter: () => {} }
  const subMenuOf = (item: ReturnType<typeof clusteringMenuItem>) =>
    'subMenu' in item ? item.subMenu : []

  it('leaves a run row the display already disabled with its own reason', () => {
    const loading = {
      ...runItem,
      disabled: true,
      disabledHelpText: 'Loading rows...',
    }
    expect(subMenuOf(clusteringMenuItem(model, loading, 0))[0]).toBe(loading)
  })

  it('disables the run row below two rows and says why', () => {
    expect(subMenuOf(clusteringMenuItem(model, runItem, 1))[0]).toMatchObject({
      label: 'Cluster rows by score...',
      disabled: true,
      disabledHelpText: 'Needs at least two rows to cluster',
    })
  })

  it('enables the run row at two rows', () => {
    expect(subMenuOf(clusteringMenuItem(model, runItem, 2))[0]).toMatchObject({
      disabled: false,
    })
  })
})
