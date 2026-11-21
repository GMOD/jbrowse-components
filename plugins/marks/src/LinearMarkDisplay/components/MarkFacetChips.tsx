import { GroupLabelChips } from '@jbrowse/display-kit/GroupLabelChips'
import { observer } from 'mobx-react'

import type { MarkDisplayModel } from './markDisplayTypes.ts'

/**
 * The facet's section chips over the plot, in a layer starting where the
 * plot's canvas does. A section's band is its rows at the height the plot gave
 * them, and the plot never scrolls — the rows shrink to fit instead — so a
 * chip's top is its first row's.
 */
const MarkFacetChips = observer(function MarkFacetChips({
  model,
}: {
  model: MarkDisplayModel
}) {
  const { sections, rows } = model.facetLayout
  const { yTop, plotHeight } = model.plotBox
  const rowHeight = model.effectiveRowHeight
  return rows ||
    (sections.length === 0 && model.hiddenGroups.size === 0) ? null : (
    <div
      data-testid="mark-facet-chips"
      style={{
        position: 'absolute',
        top: yTop,
        left: 0,
        width: model.canvasWidthPx,
        height: plotHeight,
        pointerEvents: 'none',
      }}
    >
      <GroupLabelChips
        host={model}
        canvasHeight={plotHeight}
        sections={sections.map(section => ({
          key: section.key,
          label: section.label,
          top: section.firstRow * rowHeight,
          height: section.rowCount * rowHeight,
        }))}
      />
    </div>
  )
})

export default MarkFacetChips
