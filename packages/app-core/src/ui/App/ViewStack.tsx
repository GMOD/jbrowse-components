import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ViewContainer from './ViewContainer.tsx'

import type {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

const useStyles = makeStyles()({
  // trailing space so the last view can scroll up past the bottom of a
  // container that would otherwise clip its lower edge
  spacer: {
    height: 300,
  },
})

const ViewStack = observer(function ViewStack({
  views,
  session,
}: {
  views: AbstractViewModel[]
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const { classes } = useStyles()

  // View ids present at first render: these arrived with the page (session
  // restore / initial load), so they must not steal scroll when they mount. A
  // view whose id isn't in this set was added later and auto-scrolls into view.
  const [initialViewIds] = useState(() => new Set(views.map(v => v.id)))

  return (
    <>
      {views.map(view => (
        <ViewContainer
          key={view.id}
          view={view}
          session={session}
          scrollOnMount={!initialViewIds.has(view.id)}
        />
      ))}
      <div className={classes.spacer} />
    </>
  )
})

export default ViewStack
