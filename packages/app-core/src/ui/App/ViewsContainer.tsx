import { Suspense } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { ViewLauncher, WorkspaceContainer } from './lazyParts.ts'

import type { AppSession } from './types.ts'

const useStyles = makeStyles()({
  viewsContainer: {
    gridRow: 'components',
    overflow: 'hidden',
  },
})

const ViewsContainer = observer(function ViewsContainer({
  session,
}: {
  session: AppSession
}) {
  const { views } = session
  const { classes } = useStyles()

  return (
    <div className={classes.viewsContainer}>
      <Suspense fallback={null}>
        {views.length > 0 ? (
          <WorkspaceContainer session={session} />
        ) : (
          <ViewLauncher session={session} />
        )}
      </Suspense>
    </div>
  )
})

export default ViewsContainer
