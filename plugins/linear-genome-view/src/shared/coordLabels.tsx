import { useEffect, useRef, useState } from 'react'

import { MUI_TOOLTIP_Z_INDEX } from '@jbrowse/core/ui/zIndexes'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material'
import { createPortal } from 'react-dom'

// roughly how wide a coordinate label is. the guide clamps itself half of this
// from either border, and a rubberband label that would hang off a border goes
// inside its edge instead — the popper's `preventOverflow`, without the popper
export const LABEL_WIDTH = 100

// gap between the bottom of a guide label and the top of the guide it labels
const LABEL_GAP = 3

const useStyles = makeStyles()(theme => ({
  // zero height so it takes no flow space while sticking with the scalebar.
  // sticky positioning makes this a stacking context, so the z-index has to
  // live here rather than on the labels it traps
  anchor: {
    height: 0,
    zIndex: 1002,
  },
  label: {
    background: alpha(theme.palette.grey[700], 0.92),
    color: theme.palette.common.white,
    borderRadius: theme.shape.borderRadius,
    padding: '2px 6px',
    fontSize: theme.typography.pxToRem(11),
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
  spanLabel: {
    position: 'absolute',
  },
  guideLabel: {
    position: 'fixed',
    transform: 'translateX(-50%)',
    zIndex: MUI_TOOLTIP_Z_INDEX,
  },
  leftOfEdge: {
    right: '100%',
    marginRight: 2,
  },
  rightOfEdge: {
    left: '100%',
    marginLeft: 2,
  },
  insideLeftEdge: {
    left: 0,
  },
  insideRightEdge: {
    right: 0,
  },
}))

function anchorStyle(stickyTop: string | undefined) {
  return stickyTop === undefined
    ? ({ position: 'relative' } as const)
    : ({ position: 'sticky', top: stickyTop } as const)
}

/**
 * The bp coordinate under a vertical guide, drawn just above the top of the
 * guide line so it covers neither the line nor the cursor hovering the scalebar
 * the line starts at.
 *
 * A zero-height anchor marks that spot in the flow (`stickyTop` pins it to the
 * scalebar it rides once that scrolls away) but the label itself portals to the
 * body: sitting above the guide means sitting above the top of the tracks
 * container, and that container's `contain: layout` traps its children in a
 * stacking context the sticky LGV header (z-index 850, opaque background)
 * paints over. So the anchor's viewport position is measured and the label
 * placed at fixed coordinates outside it.
 *
 * Deliberately not a MUI Tooltip: it is permanently open and re-renders on
 * every pan frame, and an open popper re-runs its whole modifier chain (~17
 * getBoundingClientRect calls) on every render of its parent, since MUI's
 * `BasePopper` calls `forceUpdate()` from a dep-less effect. Here the anchor is
 * measured once per hover, not per mousemove — only `coordX` changes as the
 * mouse moves, and that needs no measurement.
 */
export function GuideLabel({
  coordX,
  viewWidth,
  stickyTop,
  children,
}: {
  coordX: number
  viewWidth: number
  stickyTop: string | undefined
  children: React.ReactNode
}) {
  const { classes, cx } = useStyles()
  const anchorRef = useRef<HTMLDivElement>(null)
  const [anchorPos, setAnchorPos] = useState<{
    left: number
    top: number
    viewportHeight: number
  }>()

  useEffect(() => {
    const measure = () => {
      const el = anchorRef.current
      if (el) {
        const { left, top } = el.getBoundingClientRect()
        setAnchorPos({ left, top, viewportHeight: window.innerHeight })
      }
    }
    measure()
    // capture phase: the anchor can ride any scrolling ancestor, not just the
    // window
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [stickyTop])

  const clampedX = Math.min(
    Math.max(coordX, LABEL_WIDTH / 2),
    viewWidth - LABEL_WIDTH / 2,
  )
  return (
    <>
      <div
        ref={anchorRef}
        className={classes.anchor}
        style={anchorStyle(stickyTop)}
      />
      {anchorPos
        ? createPortal(
            <div
              className={cx(classes.label, classes.guideLabel)}
              style={{
                left: anchorPos.left + clampedX,
                bottom: anchorPos.viewportHeight - anchorPos.top + LABEL_GAP,
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

/**
 * The bp coordinates of a rubberband selection, one label just outside each edge
 * of the span. Renders inside the span, so the edges are its own box. A label
 * with no room outside its edge flips inside instead, which is why the span it
 * has to fit in is a prop.
 */
export function SpanEdgeLabels({
  stickyTop,
  left,
  right,
  insideLeft,
  insideRight,
}: {
  stickyTop: string | undefined
  left: React.ReactNode
  right: React.ReactNode
  insideLeft: boolean
  insideRight: boolean
}) {
  const { classes, cx } = useStyles()
  return (
    <div className={classes.anchor} style={anchorStyle(stickyTop)}>
      <div
        className={cx(
          classes.label,
          classes.spanLabel,
          insideLeft ? classes.insideLeftEdge : classes.leftOfEdge,
        )}
      >
        {left}
      </div>
      <div
        className={cx(
          classes.label,
          classes.spanLabel,
          insideRight ? classes.insideRightEdge : classes.rightOfEdge,
        )}
      >
        {right}
      </div>
    </div>
  )
}
