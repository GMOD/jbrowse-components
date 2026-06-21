import { LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { LinearProgress } from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(theme => ({
  root: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    zIndex: 2,
    pointerEvents: 'none',
    padding: '0 4px',
    borderRadius: 4,
    background: theme.palette.background.paper,
    opacity: 0.8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  bar: {
    width: 120,
  },
}))

/**
 * Shared bottom-right "refetching" chip for the comparative views (dotplot and
 * linear synteny). Shown while a new fetch runs but stale geometry is still on
 * screen — so it stays small and out of the way instead of masking the canvas
 * the way a full overlay would. Surfaces the statusCallback message plus a
 * determinate bar when the in-flight phase reports progress. The caller gates on
 * its own `isRefetching`/`refetching` getter; this component is pure
 * presentation.
 */
const RefetchIndicator = observer(function RefetchIndicator({
  statusMessage,
  statusProgress,
}: {
  statusMessage?: string
  statusProgress?: number
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.root}>
      <LoadingEllipses
        message={
          statusProgress === undefined
            ? statusMessage
            : `${statusMessage || 'Loading'} ${Math.round(statusProgress * 100)}%`
        }
      />
      {statusProgress === undefined ? null : (
        <LinearProgress
          className={classes.bar}
          variant="determinate"
          value={Math.min(100, statusProgress * 100)}
        />
      )}
    </div>
  )
})

export default RefetchIndicator
