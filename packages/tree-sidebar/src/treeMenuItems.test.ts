import { clusterProvenanceFromRegions } from './clusterProvenance.ts'
import { clusterProvenanceMenuItems } from './treeMenuItems.ts'

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
