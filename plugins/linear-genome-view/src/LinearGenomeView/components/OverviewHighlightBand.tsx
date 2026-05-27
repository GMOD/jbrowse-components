import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Tooltip } from '@mui/material'

// Renders a single absolute-positioned band over the overview scalebar. Used
// for both LGV `view.highlight` entries and grid-bookmark bookmark highlights.
// The 1px border keeps very narrow bands visible.
const useStyles = makeStyles()({
  highlight: {
    height: '100%',
    position: 'absolute',
    left: 0,
  },
})

export default function OverviewHighlightBand({
  coords,
  background,
  borderColor,
  tooltip,
}: {
  coords: { left: number; width: number }
  background: string
  borderColor?: string
  tooltip?: string
}) {
  const { classes } = useStyles()
  const band = (
    <div
      className={classes.highlight}
      style={{
        transform: `translateX(${coords.left}px)`,
        width: coords.width,
        background,
        ...(borderColor && {
          borderLeft: `1px solid ${borderColor}`,
          borderRight: `1px solid ${borderColor}`,
        }),
      }}
    />
  )
  return tooltip ? (
    <Tooltip title={tooltip} arrow>
      {band}
    </Tooltip>
  ) : (
    band
  )
}
