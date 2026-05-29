import { ErrorBanner, LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'

const useStyles = makeStyles()({
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refetchOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    opacity: 0.7,
  },
})

// Per-display status shown over the shared canvas: a full error banner, a
// centered spinner on first load, or a small corner spinner while refetching.
const DisplayStatusOverlays = observer(function DisplayStatusOverlays({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()
  return (
    <>
      {model.dotplotDisplays.map(display =>
        display.error ? (
          <ErrorBanner key={display.id} error={display.error} />
        ) : display.isLoading ? (
          <div key={display.id} className={classes.loadingOverlay}>
            <LoadingEllipses />
          </div>
        ) : display.isRefetching ? (
          <div key={display.id} className={classes.refetchOverlay}>
            <LoadingEllipses />
          </div>
        ) : null,
      )}
    </>
  )
})

export default DisplayStatusOverlays
