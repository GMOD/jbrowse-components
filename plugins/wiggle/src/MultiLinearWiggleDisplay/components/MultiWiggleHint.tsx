import { BlockMsg } from '@jbrowse/plugin-linear-genome-view'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import type { MultiWiggleDisplayModel } from './multiWiggleDisplayTypes.ts'

// The plot would otherwise render as a silent blank in two recoverable cases;
// name the escape inline instead of leaving the user staring at nothing.
function hintMessage(model: MultiWiggleDisplayModel) {
  const { numSources, isOverlay, rowHeight } = model
  // #7: a subtree filter that matches nothing. Loaded adapter sources exist but
  // the filter removed them all (numSources is the post-filter count).
  if (model.sourcesWithoutLayout.length > 0 && numSources === 0) {
    return 'No subtracks match the current subtree filter'
  }
  // #6: multi-row mode packed so tight rows are sub-pixel — the canvas draws but
  // shows an unreadable smear.
  if (!isOverlay && numSources > 0 && rowHeight < 1) {
    return `${numSources} subtracks in ${Math.round(model.height)}px leaves rows below 1px. Switch to an overlay or density rendering, or increase the track height.`
  }
  return undefined
}

const MultiWiggleHint = observer(function MultiWiggleHint({
  model,
}: {
  model: MultiWiggleDisplayModel
}) {
  const message = hintMessage(model)
  return message ? (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1,
      }}
    >
      <BlockMsg
        severity="warning"
        message={message}
        action={
          model.subtreeFilter?.length ? (
            <Button
              onClick={() => {
                model.setSubtreeFilter(undefined)
              }}
            >
              Clear subtree filter
            </Button>
          ) : undefined
        }
      />
    </div>
  ) : null
})

export default MultiWiggleHint
