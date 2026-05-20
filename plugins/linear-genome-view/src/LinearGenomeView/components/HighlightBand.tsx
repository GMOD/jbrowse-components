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
  chip: {
    pointerEvents: 'auto',
  },
})

/**
 * Renders the colored band for a highlight or bookmark region with optional
 * chip (the children) on top. The chip is hidden when the band collapses to
 * a sub-pixel sliver. Used by both linear-genome-view's URL/session
 * highlights and grid-bookmark's bookmark highlights.
 *
 * Note: this is for the tracks-area band only. The overview scalebar
 * highlights (OverviewHighlight in both plugins) intentionally roll their
 * own — they use Base1DViewModel.bpToPx (different return shape) and have
 * no chip, so sharing this component there is more friction than gain.
 */
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
