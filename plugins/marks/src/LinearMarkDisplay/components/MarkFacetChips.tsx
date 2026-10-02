import { GroupLabelChips } from '@jbrowse/display-kit/GroupLabelChips'
import { observer } from 'mobx-react'

import type { MarkDisplayModel } from './markDisplayTypes.ts'

/**
 * The facet's section chips over the plot, in a layer starting where the
 * plot's canvas does. A section's band is its rows at the height the plot gave
 * them, and the plot never scrolls — the rows shrink to fit instead — so a
 * chip's top is its first row's. The last visible section keeps no hide
 * button: hiding it would leave no chip to come back from.
 */
const MarkFacetChips = observer(function MarkFacetChips({
  model,
  yTop,
  plotHeight,
}: {
  model: MarkDisplayModel
  yTop: number
  plotHeight: number
}) {
  const { sections, rows } = model.facetLayout
  if (rows || sections.length === 0) {
    return null
  }
  const rowHeight = model.effectiveRowHeight
  const canHide = sections.length > 1
  return (
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
        canvasHeight={plotHeight}
        hiddenCount={model.hiddenGroups.size}
        onShowHidden={() => {
          model.showAllGroups()
        }}
        sections={sections.map(section => ({
          key: section.key,
          label: section.label,
          top: section.firstRow * rowHeight,
          height: section.rowCount * rowHeight,
          onHide: canHide
            ? () => {
                model.hideGroup(section.key)
              }
            : undefined,
        }))}
      />
    </div>
  )
})

export default MarkFacetChips
