import { useRef, useState } from 'react'

import { useScrollPortOverflow } from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ViewContainer from './ViewContainer.tsx'

import type {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

const useStyles = makeStyles()({
  // trailing space so the last view can scroll up past the bottom of a
  // container that would otherwise clip its lower edge.
  //
  // Rendered only once the views themselves overflow, and that is what makes
  // the port's scrollbar honest: kept unconditionally, this alone overflowed
  // the port, so every session — a single short view included — scrolled 300px
  // into nothing and drew a scrollbar saying so. It is outside the measured
  // element for the same reason (see `useScrollPortOverflow`).
  spacer: {
    height: 300,
  },
})

const ViewStack = observer(function ViewStack({
  views,
  session,
  className,
}: {
  views: AbstractViewModel[]
  session: SessionWithFocusedViewAndDrawerWidgets
  // the wrapper's formatting context belongs to the container this stack is
  // mounted in — block in the classic stack, flex column in a workspace panel —
  // and the two space their views differently under it
  className?: string
}) {
  const { classes } = useStyles()
  const viewsRef = useRef<HTMLDivElement>(null)
  const scrollable = useScrollPortOverflow(viewsRef)

  // View ids present at first render: these arrived with the page (session
  // restore / initial load), so they must not steal scroll when they mount. A
  // view whose id isn't in this set was added later and auto-scrolls into view.
  const [initialViewIds] = useState(() => new Set(views.map(v => v.id)))

  return (
    <>
      <div ref={viewsRef} className={className}>
        {views.map(view => (
          <ViewContainer
            key={view.id}
            view={view}
            session={session}
            scrollOnMount={!initialViewIds.has(view.id)}
          />
        ))}
      </div>
      {scrollable ? <div className={classes.spacer} /> : null}
    </>
  )
})

export default ViewStack
