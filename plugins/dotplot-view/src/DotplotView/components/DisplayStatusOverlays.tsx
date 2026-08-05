import { ErrorBanner, LoadingProgress, ProgressChip } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
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
          // `onReset` is the display's own `reload()` (SyntenyFetchStateMixin),
          // not a page refresh: a PAF/adapter failure here used to render a
          // banner with no button at all, so the only way out was reloading the
          // tab. See DISPLAYCHROME.md, "The retry affordance is a contract".
          <ErrorBanner
            key={display.id}
            error={display.error}
            onReset={() => {
              display.reload()
            }}
          />
        ) : display.loading ? (
          <div key={display.id} className={classes.loadingOverlay}>
            <LoadingProgress
              message={display.statusMessage}
              fraction={display.statusProgress}
              barClassName={classes.bar}
            />
          </div>
        ) : display.refetching ? (
          <ProgressChip
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
