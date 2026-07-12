import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()({
  highlight: {
    height: '100%',
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
    // paint above sibling TrackContainers (which would otherwise win in
    // tree order). pointer-events:none lets clicks fall through to the
    // tracks except on the chip itself
    zIndex: 1,
    pointerEvents: 'none',
  },
  // full-width strip along the band top: the only pointer-interactive part of
  // the band (the body stays click-through). The chip fades in on hover so the
  // highlight menu stays reachable without a persistent icon cluttering the view
  chip: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    pointerEvents: 'auto',
    opacity: 0,
    transition: 'opacity 150ms',
    '&:hover': {
      opacity: 1,
    },
  },
})

// Shared band renderer for LGV and grid-bookmark highlights; OverviewHighlight
// stays separate (different bpToPx API, no chip)
export default function HighlightBand({
  coords,
  background,
  children,
}: {
  coords: { left: number; width: number }
  background: string
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <div
      className={classes.highlight}
      style={{
        transform: `translateX(${coords.left}px)`,
        width: coords.width,
        background,
      }}
    >
      {coords.width > 3 && children ? (
        <div className={classes.chip}>{children}</div>
      ) : null}
    </div>
  )
}
