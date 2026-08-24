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

/**
 * Every display in the view with an active feature highlight — from a text
 * search or the right-click "Highlight feature" menu, which land in the same
 * set.
 *
 * The header reads this rather than leaving it to the button below, because
 * whether the button is in the row changes how much of the row is left for
 * everything else (see `headerFit`).
 */
export function highlightedDisplays(model: LinearGenomeViewModel) {
  return model.tracks
    .flatMap(t => t.displays)
    .filter(isFeatureHighlightCapable)
    .filter(d => d.featureHighlights.length > 0)
}

// Clears every highlight in the view at once. Shown only while there is one.
const HeaderClearHighlightButton = observer(
  function HeaderClearHighlightButton({
    highlighted,
  }: {
    highlighted: FeatureHighlightCapableDisplay[]
  }) {
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
