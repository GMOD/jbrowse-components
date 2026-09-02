import { ResizeHandle } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()({
  seam: {
    height: 5,
    boxSizing: 'border-box',
  },
})

/**
 * The drag strip on a band's bottom edge, straddling its seam with what is
 * below. `top` is where the seam is drawn; the caller turns a delta into the
 * target it wants, since which number the seam is measured from differs per
 * band (a reserved height, an effective height).
 */
export function BandSeamHandle({
  top,
  onDrag,
  title,
  'data-testid': testId,
}: {
  top: number
  onDrag: (distance: number) => void
  title?: string
  'data-testid'?: string
}) {
  const { classes } = useStyles()
  return (
    <ResizeHandle
      data-testid={testId}
      style={{ position: 'absolute', top: top - 4 }}
      className={classes.seam}
      title={title}
      onDrag={d => {
        onDrag(d)
      }}
    />
  )
}
