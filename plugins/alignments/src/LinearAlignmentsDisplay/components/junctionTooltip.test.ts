import { formatLocationRange } from '@jbrowse/alignments-core'

import { splitClassOf } from '../../features/junctions/junctionClass.ts'
import { junctionWidgetFeature } from './detailWidgets.ts'
import { formatJunctionTooltip } from './tooltipUtils.ts'

import type { JunctionKind } from '../../features/junctions/junctionClass.ts'

describe('formatLocationRange', () => {
  // The junction start is stored 0-based half-open; the tooltip must render it
  // 1-based (start + 1) to agree with formatCigarTooltip/formatLocation and the
  // detail widget (openJunctionWidget stores the raw start, shown as start + 1).
  it('renders the start 1-based and the end as-is', () => {
    expect(formatLocationRange('chr1', 1000, 2000)).toBe('chr1:1,001-2,000')
  })

  it('handles a junction at the very start of a contig', () => {
    expect(formatLocationRange('chr1', 0, 100)).toBe('chr1:1-100')
  })
})

function junction(kind: JunctionKind) {
  return {
    refName: 'chr3',
    start: 100,
    end: 185,
    count: 5,
    strand: 0,
    motif: 0,
    kind,
    split: splitClassOf(kind),
  }
}

describe('a gap deletion', () => {
  it('names itself and counts the reads carrying its gap in the tooltip', () => {
    expect(formatJunctionTooltip(junction('gapDeletion'))).toMatchObject({
      name: 'Deletion (gapped reads)',
      score: 5,
      countLabel: 'Reads with exactly this gap',
    })
    expect(formatJunctionTooltip(junction('splitForward'))).toMatchObject({
      name: 'Split junction (deletion-type)',
      countLabel: 'Reads supporting junction',
    })
  })

  it('names itself and counts the reads carrying its gap in the widget', () => {
    expect(junctionWidgetFeature(junction('gapDeletion'), 'g')).toMatchObject({
      name: 'Deletion (gapped reads)',
      type: 'deletion',
      score: 5,
      description: 'Reads with exactly this gap: 5',
    })
    expect(junctionWidgetFeature(junction('splitForward'), 'g')).toMatchObject({
      name: 'Split junction (deletion-type)',
      type: 'split_deletion',
      score: 5,
    })
  })
})
