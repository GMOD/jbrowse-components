import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'

// Duck-typed so the generic LGV header doesn't depend on the canvas plugin: any
// display that exposes a featureHighlights list + clearFeatureHighlights action
// (see canvas LinearCanvasBaseDisplay) participates.
interface FeatureHighlightCapableDisplay {
  featureHighlights: { length: number }
  clearFeatureHighlights: () => void
}

function isFeatureHighlightCapable(
  d: unknown,
): d is FeatureHighlightCapableDisplay {
  return (
    typeof d === 'object' &&
    d !== null &&
    'featureHighlights' in d &&
    'clearFeatureHighlights' in d &&
    typeof d.clearFeatureHighlights === 'function'
  )
}

// Shows a "clear highlights" button in the header only while some track in the
// view has an active feature highlight (from a text search or the right-click
// "Highlight feature" menu — both land in the same set); clicking it clears
// every one.
const HeaderClearHighlightButton = observer(
  function HeaderClearHighlightButton({
    model,
  }: {
    model: LinearGenomeViewModel
  }) {
    const highlighted = model.tracks
      .flatMap(t => t.displays)
      .filter(isFeatureHighlightCapable)
      .filter(d => d.featureHighlights.length > 0)

    return highlighted.length > 0 ? (
      <IconButton
        data-testid="clear_search_highlight"
        title="Clear highlights"
        onClick={() => {
          for (const d of highlighted) {
            d.clearFeatureHighlights()
          }
        }}
      >
        <HighlightOffIcon />
      </IconButton>
    ) : null
  },
)

export default HeaderClearHighlightButton
