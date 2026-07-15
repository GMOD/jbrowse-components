import { VerticalScrollbar } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import type { MultiSampleVariantBaseModel } from '../MultiSampleVariantBaseModel.ts'

// VerticalScrollbar bound to the shared multi-sample variant scroll geometry, so
// both variant displays render an identical scrollbar from just the model. The
// scroll gesture lives in useVariantVirtualScroll; this is the draggable thumb.
const VariantScrollbar = observer(function VariantScrollbar({
  model,
  controlsId,
}: {
  model: MultiSampleVariantBaseModel
  controlsId: string
}) {
  return (
    <VerticalScrollbar
      scrollTop={model.scrollTop}
      setScrollTop={n => {
        model.setScrollTop(n)
      }}
      viewportHeight={model.availableHeight}
      contentHeight={model.totalHeight}
      controlsId={controlsId}
    />
  )
})

export default VariantScrollbar
