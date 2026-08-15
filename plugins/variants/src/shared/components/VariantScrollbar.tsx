import { ScrollEdgeShadow, VerticalScrollbar } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import type { MultiSampleVariantBaseModel } from '../MultiSampleVariantBaseModel.ts'

// The scroll affordances bound to the shared multi-sample variant scroll
// geometry, so both variant displays render them identically from just the
// model: the draggable thumb, and the edge fade saying rows are hidden past an
// edge. The scroll gesture itself lives in useVariantVirtualScroll.
//
// Both take the rows' own viewport — `availableHeight` at `rowsTopOffset`,
// since the bands stacked above the rows are pinned and don't scroll. The
// scrollbar had been taking the height without the offset, which put its track
// a band's worth too high: invisible while it was the only thing there, and the
// matrix display's `lineZoneHeight` defaults to 20, so this was the default
// state rather than an edge case.
const VariantScrollbar = observer(function VariantScrollbar({
  model,
  controlsId,
}: {
  model: MultiSampleVariantBaseModel
  controlsId: string
}) {
  return (
    <>
      <ScrollEdgeShadow
        scrollTop={model.scrollTop}
        viewportHeight={model.availableHeight}
        contentHeight={model.totalHeight}
        top={model.rowsTopOffset}
      />
      <VerticalScrollbar
        scrollTop={model.scrollTop}
        setScrollTop={n => {
          model.setScrollTop(n)
        }}
        viewportHeight={model.availableHeight}
        contentHeight={model.totalHeight}
        controlsId={controlsId}
        top={model.rowsTopOffset}
      />
    </>
  )
})

export default VariantScrollbar
