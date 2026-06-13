import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

const useStyles = makeStyles()({
  box: {
    position: 'absolute',
    pointerEvents: 'none',
  },
})

// Hover highlight as a positioned overlay div instead of a canvas pass. The
// hovered-feature id changes on nearly every mousemove; keeping it out of the
// canvas renderState means a hover only re-renders this tiny overlay, not the
// full pileup (which on the Canvas2D fallback re-rasterizes every base).
const HighlightOverlay = observer(function HighlightOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { classes } = useStyles()
  const boxes = model.highlightBoxes
  const isChain =
    model.linkedReads === 'normal' && model.highlightedChainIds.length > 0
  const background = isChain ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.15)'
  return (
    <>
      {boxes.map((b, i) => (
        <div
          // eslint-disable-next-line @eslint-react/no-array-index-key -- highlight boxes are plain geometry with no identifying field, recomputed each render
          key={i}
          className={classes.box}
          style={{
            left: b.left,
            top: b.top,
            width: b.width,
            height: b.height,
            background,
          }}
        />
      ))}
    </>
  )
})

export default HighlightOverlay
