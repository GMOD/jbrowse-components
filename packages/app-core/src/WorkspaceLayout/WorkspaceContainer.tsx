import { Suspense, useMemo } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ViewStack from '../ui/App/ViewStack.tsx'
import { ViewLauncher } from '../ui/App/lazyParts.ts'
import { LayoutRenderer } from './LayoutRenderer.tsx'
import { WorkspacePanelActions } from './WorkspacePanelActions.tsx'
import { WorkspaceTab } from './WorkspaceTab.tsx'
import { useLayoutDrag } from './useLayoutDrag.ts'

import type { WorkspaceSessionType } from '../ui/App/types.ts'
import type { PanelChrome } from './panelChrome.ts'

const useStyles = makeStyles()(theme => ({
  container: {
    height: '100%',
    width: '100%',
    display: 'flex',
    gridRow: 'components',
    background: theme.palette.background.default,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
}))

export const WorkspaceContainer = observer(function WorkspaceContainer({
  session,
}: {
  session: WorkspaceSessionType
}) {
  const { classes } = useStyles()
  const { drag, handlers } = useLayoutDrag(session)

  // memoised by hand (the React Compiler skips `observer`): a fresh object
  // re-renders every panel's ViewStack. `drag` stays out for the same reason.
  const chrome = useMemo<PanelChrome>(
    () => ({
      dragHandlers: handlers,
      onTabClose: tabId => {
        session.closeTab(tabId)
      },
      renderPanelActions: panel => (
        <WorkspacePanelActions
          panel={panel}
          session={session}
          onClose={() => {
            session.closePanel(panel.id)
          }}
        />
      ),
      renderTabLabel: tab => (
        <WorkspaceTab
          tab={tab}
          views={viewsOf(session, tab.viewIds)}
          session={session}
          onClose={() => {
            session.closeTab(tab.id)
          }}
        />
      ),
      renderTabContent: tab => {
        const views = viewsOf(session, tab.viewIds)
        return views.length > 0 ? (
          <ViewStack views={views} session={session} />
        ) : (
          <div className={classes.empty}>
            <Suspense fallback={null}>
              <ViewLauncher session={session} />
            </Suspense>
          </div>
        )
      },
    }),
    [session, handlers, classes.empty],
  )

  return (
    <div className={classes.container} data-testid="workspace">
      <LayoutRenderer
        node={session.visibleTree}
        layout={session}
        drag={drag}
        chrome={chrome}
      />
    </div>
  )
})

// `session.views` is the order; a tab's `viewIds` is membership only
function viewsOf(session: WorkspaceSessionType, viewIds: string[]) {
  const members = new Set(viewIds)
  return session.views.filter(v => members.has(v.id))
}
