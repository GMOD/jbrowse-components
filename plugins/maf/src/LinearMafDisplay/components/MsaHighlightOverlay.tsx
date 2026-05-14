import React from 'react'

import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../stateModel'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const MsaHighlightOverlay = observer(function MsaHighlightOverlay({
  model,
  view,
  height,
}: {
  model: LinearMafDisplayModel
  view: LinearGenomeViewModel
  height: number
}) {
  const { msaHighlights } = model
  if (msaHighlights.length === 0) {
    return null
  }

  const { offsetPx } = view
  const displayedRegion = view.displayedRegions[0]
  if (!displayedRegion) {
    return null
  }

  return (
    <>
      {msaHighlights.map((highlight, idx) => {
        // Check if highlight is on the displayed refName
        if (highlight.refName !== displayedRegion.refName) {
          return null
        }

        const startPx =
          (highlight.start - displayedRegion.start) / view.bpPerPx - offsetPx
        const endPx =
          (highlight.end - displayedRegion.start) / view.bpPerPx - offsetPx
        const widthPx = Math.max(endPx - startPx, 2)

        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: startPx,
              top: 0,
              width: widthPx,
              height,
              backgroundColor: 'rgba(255, 165, 0, 0.4)',
              border: '1px solid rgba(255, 165, 0, 0.8)',
              pointerEvents: 'none',
            }}
          />
        )
      })}
    </>
  )
})

export default MsaHighlightOverlay
