import { Suspense, lazy } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { isSessionWithWorkspaceLayout } from '../../WorkspaceLayout/model.ts'
import { lazyChunk } from './lazyChunk.ts'

import type { AppSession } from './types.ts'

const ClassicViewsContainer = lazy(
  lazyChunk(
    'ClassicViewsContainer',
    () => import('./ClassicViewsContainer.tsx'),
  ),
)
const WorkspaceContainer = lazy(
  lazyChunk('WorkspaceContainer', () =>
    import('../../WorkspaceLayout/WorkspaceContainer.tsx').then(m => ({
      default: m.WorkspaceContainer,
    })),
  ),
)
const ViewLauncher = lazy(
  lazyChunk('ViewLauncher', () => import('./ViewLauncher.tsx')),
)

const useStyles = makeStyles()({
  viewsContainer: {
    gridRow: 'components',
    overflow: 'hidden',
  },
})

interface Props {
  HeaderButtons?: React.ReactElement
  session: AppSession
}

const ViewsContainer = observer(function ViewsContainer(props: Props) {
  const { session } = props
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
