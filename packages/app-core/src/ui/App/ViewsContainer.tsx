import { Suspense } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { isSessionWithWorkspaceLayout } from '../../WorkspaceLayout/model.ts'
import {
  ClassicViewsContainer,
  ViewLauncher,
  WorkspaceContainer,
} from './lazyParts.ts'

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
  const { views, effectiveUseWorkspaces } = session
  const { classes } = useStyles()

  return (
    <div className={classes.viewsContainer}>
      <Suspense fallback={null}>
        {views.length > 0 ? (
          effectiveUseWorkspaces && isSessionWithWorkspaceLayout(session) ? (
            <WorkspaceContainer session={session} />
          ) : (
            <ClassicViewsContainer session={session} />
          )
        ) : (
          <ViewLauncher session={session} />
        )}
      </Suspense>
    </div>
  )
})

export default ViewsContainer
