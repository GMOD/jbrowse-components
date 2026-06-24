import type { ReactNode } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'

import { OVERFLOW_INDICATOR_Z_INDEX } from './sharedRendererConstants.ts'

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
    >
      {children}
    </div>
  )
}

export default BottomRightIndicators
