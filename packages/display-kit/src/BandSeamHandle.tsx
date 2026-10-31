import ResizeHandle from '@jbrowse/core/ui/ResizeHandle'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type React from 'react'

export const BAND_SEAM_HIT_PX = 5
const SEAM_OVERHANG_PX = 1

const useStyles = makeStyles()({
  seam: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAND_SEAM_HIT_PX,
    boxSizing: 'border-box',
    zIndex: 10,
  },
})

/**
 * The drag strip on a band's bottom edge, straddling its seam with what is
 * below: mostly inside the band it sizes, a pixel over the seam so a line
 * drawn there is grabbable. `seam` is the seam's y in the parent's box; the
 * caller turns a delta into the height it wants, since which number the seam
 * is measured from differs per band.
 */
export const BandSeamHandle = observer(function BandSeamHandle({
  seam,
  className,
  style,
  ...props
}: { seam: number } & React.ComponentProps<typeof ResizeHandle>) {
  const { classes } = useStyles()
  return (
    <ResizeHandle
      {...props}
      className={cx(classes.seam, className)}
      style={{ ...style, top: seam - BAND_SEAM_HIT_PX + SEAM_OVERHANG_PX }}
    />
  )
})
