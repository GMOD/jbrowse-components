import {
  ErrorBanner,
  LoadingEllipses,
  StatusProgressBar,
} from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { RefetchIndicator } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'

const useStyles = makeStyles()({
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bar: {
    width: 160,
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
            <LoadingEllipses message={display.statusMessage} />
            {display.statusProgress === undefined ? null : (
              <StatusProgressBar
                className={classes.bar}
                fraction={display.statusProgress}
              />
            )}
          </div>
        ) : display.isRefetching ? (
          <RefetchIndicator
            key={display.id}
            statusMessage={display.statusMessage}
            statusProgress={display.statusProgress}
          />
        ) : null,
      )}
    </>
  )
})

export default DisplayStatusOverlays
