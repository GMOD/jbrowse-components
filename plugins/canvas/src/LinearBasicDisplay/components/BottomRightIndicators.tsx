import { makeStyles } from '@jbrowse/core/util/tss-react'

import { OVERFLOW_INDICATOR_Z_INDEX } from './sharedRendererConstants.ts'

import type { ReactNode } from 'react'

// Width reserved for the scroll container's own scrollbar, so indicators
// don't render underneath it when the content overflows.
const SCROLLBAR_WIDTH = 14

const useStyles = makeStyles()(() => ({
  root: {
    position: 'absolute',
    bottom: 2,
    zIndex: OVERFLOW_INDICATOR_Z_INDEX,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    pointerEvents: 'auto',
  },
}))

// Single anchor point for every bottom-right overlay (overflow expand/restore,
// isoform-collapse notice, ...) so they lay out as one row instead of each
// picking their own position and colliding. Children are self-gating (each
// renders null when inactive); an all-null flex container has no size, so
// there's no need to also track "is anything visible" here — callers just
// render every indicator unconditionally.
function BottomRightIndicators({
  hasOverflow,
  children,
}: {
  hasOverflow: boolean
  children: ReactNode
}) {
  const { classes } = useStyles()
  return (
    <div
      className={classes.root}
      style={{ right: hasOverflow ? SCROLLBAR_WIDTH + 2 : 2 }}
      // Claim the press, the same way VerticalScrollbar does. An embedder that
      // pans the view with its own pointer handler sits above this row; if it
      // captures the pointer on pointerdown, the click that opens these menus
      // is retargeted at the embedder's element and never arrives. JBrowse's
      // own pan skips `button` targets, so this is for everyone else's.
      data-gesture-owner="true"
      onPointerDown={event => {
        event.stopPropagation()
      }}
    >
      {children}
    </div>
  )
}

export default BottomRightIndicators
