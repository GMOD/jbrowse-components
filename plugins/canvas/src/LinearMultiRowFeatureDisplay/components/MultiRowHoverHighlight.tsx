import { hoverBoxStyle } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import type { LinearMultiRowFeatureDisplayModel } from '../model.ts'

// Its own observer, so a hover repaints this layer and not the canvas around it.
const MultiRowHoverHighlight = observer(function MultiRowHoverHighlight({
  model,
}: {
  model: LinearMultiRowFeatureDisplayModel
}) {
  const { highlightedBlockRect } = model
  return highlightedBlockRect ? (
    <div
      data-testid="multirow_hover_highlight"
      style={{
        position: 'absolute',
        ...highlightedBlockRect,
        ...hoverBoxStyle,
        pointerEvents: 'none',
      }}
    />
  ) : null
})

export default MultiRowHoverHighlight
