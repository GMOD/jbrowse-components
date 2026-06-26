import { LoadingEllipses, StatusProgressBar } from '@jbrowse/core/ui'
import { statusFraction, statusMessageText } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import type { RpcStatus } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: 20,
  },
  bar: {
    width: 300,
    maxWidth: '80%',
  },
})

/**
 * Full-view loading screen shown while a comparative view (dotplot / linear
 * synteny) auto-diagonalizes on open. Surfaces the diagonalize RPC's
 * statusCallback (download %, parse, algorithm phase) as a LoadingEllipses
 * label plus a determinate bar — the auto path's counterpart to the manual
 * re-order dialog — and offers a Cancel that aborts the reorder and reveals the
 * undiagonalized view. Shared so both views report progress identically.
 */
const DiagonalizeLoadingScreen = observer(function DiagonalizeLoadingScreen({
  status,
  onCancel,
}: {
  status?: RpcStatus
  onCancel?: () => void
}) {
  const { classes } = useStyles()
  const fraction = statusFraction(status)
  // LoadingEllipses supplies its own animated dots, so the source phase labels
  // carry no trailing ellipsis. Append the percent when determinate, mirroring
  // RefetchIndicator.
  const base = statusMessageText(status) || 'Reordering chromosomes'
  return (
    <div className={classes.root}>
      <LoadingEllipses
        variant="h6"
        message={
          fraction === undefined
            ? base
            : `${base} ${Math.round(fraction * 100)}%`
        }
      />
      <StatusProgressBar status={status} className={classes.bar} />
      {onCancel ? (
        <Button
          color="secondary"
          onClick={() => {
            onCancel()
          }}
        >
          Cancel
        </Button>
      ) : null}
    </div>
  )
})

export default DiagonalizeLoadingScreen
