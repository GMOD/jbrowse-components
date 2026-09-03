import { ErrorBanner } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ComparativeFetchStatus } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'

const useStyles = makeStyles()({
  // These overlays hang inside DotplotView's pointer-events:none layer (so the
  // canvas above the interaction layer doesn't swallow the drag), and
  // pointer-events inherits. ComparativeFetchStatus manages its own; the banner
  // below has a Retry button, which without this is drawn but not clickable.
  interactive: {
    pointerEvents: 'auto',
  },
})

// Per-display status over the shared canvas. The loading/refetch half is
// `ComparativeFetchStatus`, the same component the synteny level renders — this
// file used to hand-roll a centred spinner in a local `makeStyles` and chain the
// three states as a ternary, so the two views showed different things for the
// same state and neither got the overlay's anti-flash behaviour.
//
// The error banner stays here rather than moving into the shared component
// because the two views place it differently on purpose: one per display here,
// one combined with the level's GPU error over on the synteny side, where a
// single canvas serves the whole band.
const DisplayStatusOverlays = observer(function DisplayStatusOverlays({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()
  return (
    <>
      {model.dotplotDisplays.map(display => (
        <div key={display.id}>
          {display.error ? (
            // `onReset` is the display's own `reload()` (FetchMixin's),
            // not a page refresh: a PAF/adapter failure here used to render a
            // banner with no button at all, so the only way out was reloading the
            // tab. See DISPLAYCHROME.md §"The retry contract".
            <div className={classes.interactive}>
              <ErrorBanner
                error={display.error}
                onReset={() => {
                  display.reload()
                }}
              />
            </div>
          ) : null}
          <ComparativeFetchStatus display={display} />
        </div>
      ))}
    </>
  )
})

export default DisplayStatusOverlays
