import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

// A single-read hover uses the theme's featureHover shade; a hovered linked-read
// chain uses the stronger featureHoverStrong so the whole group stands out. Both
// lighten on a dark track (see theme.ts) instead of an invisible dark shade.
const useStyles = makeStyles()(theme => ({
  box: {
    position: 'absolute',
    pointerEvents: 'none',
  },
  read: {
    background: theme.palette.featureHover,
  },
  chain: {
    background: theme.palette.featureHoverStrong,
  },
}))

// Hover highlight as a positioned overlay div instead of a canvas pass. The
// hovered-feature id changes on nearly every mousemove; keeping it out of the
// canvas renderState means a hover only re-renders this tiny overlay, not the
// full pileup (which on the Canvas2D fallback re-rasterizes every base).
const HighlightOverlay = observer(function HighlightOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { classes, cx } = useStyles()
  const boxes = model.highlightBoxes
  const isChain = model.highlightChainIds.length > 0
  return (
    <>
      {boxes.map((b, i) => (
        <div
          // eslint-disable-next-line @eslint-react/no-array-index-key -- highlight boxes are plain geometry with no identifying field, recomputed each render
          key={i}
          className={cx(classes.box, isChain ? classes.chain : classes.read)}
          style={{
            left: b.left,
            top: b.top,
            width: b.width,
            height: b.height,
          }}
        />
      ))}
    </>
  )
})

export default HighlightOverlay
