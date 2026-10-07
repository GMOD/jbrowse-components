import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(theme => ({
  highlight: {
    height: '100%',
    position: 'absolute',
    left: 0,
    // clip rather than hidden so this never becomes a scroll container (see
    // Scalebar)
    overflow: 'clip',
    // paint above sibling TrackContainers (which would otherwise win in tree
    // order). pointer-events:none lets clicks fall through to the tracks; an
    // interactive chip re-enables pointer-events on itself
    zIndex: 1,
    pointerEvents: 'none',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 3,
  },
  label: {
    color: theme.palette.text.primary,
  },
}))

export function gapMask(gaps: { top: number; height: number }[]) {
  const stops = gaps.flatMap(g => [
    `#000 ${g.top}px`,
    `transparent ${g.top}px`,
    `transparent ${g.top + g.height}px`,
    `#000 ${g.top + g.height}px`,
  ])
  return `linear-gradient(to bottom, ${stops.join(', ')})`
}

// OverviewHighlight stays separate (different bpToPx API). A non-interactive
// colored band with an
// optional top label; when `children` (the highlight chip) is passed it renders
// that instead of the plain label. Visibility is toggled from the view menu
const HighlightBand = observer(function HighlightBand({
  coords,
  background,
  label,
  gaps,
  children,
}: {
  coords: { left: number; width: number }
  background: string
  label?: string
  gaps?: { top: number; height: number }[]
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  const content =
    children ??
    (label ? (
      <Typography variant="caption" className={classes.label} noWrap>
        {label}
      </Typography>
    ) : null)
  return (
    <div
      data-testid="highlight-band"
      className={classes.highlight}
      style={{
        transform: `translateX(${coords.left}px)`,
        width: coords.width,
        background,
        ...(gaps?.length
          ? { maskImage: gapMask(gaps), WebkitMaskImage: gapMask(gaps) }
          : undefined),
      }}
    >
      {coords.width > 3 && content ? (
        <div className={classes.overlay}>{content}</div>
      ) : null}
    </div>
  )
})

export default HighlightBand
