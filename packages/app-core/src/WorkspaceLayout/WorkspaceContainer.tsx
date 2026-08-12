import { Suspense, lazy, useEffect } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import ViewStack from '../ui/App/ViewStack.tsx'
import { LayoutRenderer } from './LayoutRenderer.tsx'
import { WorkspacePanelActions } from './WorkspacePanelActions.tsx'
import { WorkspaceTab } from './WorkspaceTab.tsx'
import { useLayoutDrag } from './useLayoutDrag.ts'

import type { WorkspaceSessionType } from '../ui/App/types.ts'
import type { WorkspaceLayout } from './model.ts'

const ViewLauncher = lazy(() => import('../ui/App/ViewLauncher.tsx'))

const useStyles = makeStyles()(theme => ({
  container: {
    height: '100%',
    width: '100%',
    display: 'flex',
    gridRow: 'components',
    background: theme.palette.background.default,
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
}))

type WorkspaceSession = WorkspaceSessionType & WorkspaceLayout

/**
 * The workspace. Compare `TiledViewsContainer` + `useDockviewController`, which
 * this replaces: there is no api to hold, no `onReady`, no event to subscribe
 * to, and no reconciliation — the layout is session state and this renders it.
 *
 * The one reaction left is homing: `session.views` is owned by the session, so
 * a view launched from a menu arrives belonging to no tab and has to land
 * somewhere. That is one-directional and idempotent, and nothing reads back.
 */
export const WorkspaceContainer = observer(function WorkspaceContainer({
  session,
}: {
  session: WorkspaceSession
}) {
  const { classes } = useStyles()
  const { drag, ...dragHandlers } = useLayoutDrag(session)

  useEffect(
    () =>
      autorun(() => {
        // reads session.views itself, so it re-runs when the view set changes;
        // homeUnassignedViews is an action and would not be tracked from inside
        session.homeUnassignedViews(session.views.map(v => v.id))
      }),
    [session],
  )

  // The layout does not own views, so closing a tab is explicitly the pair —
  // and it is ONE function because two callers now need it (the tab's own ⋮
  // menu, and middle-clicking the tab). Spelled out at each, one of them ends
  // up dropping the tab and leaving its views in the session forever.
  const closeTab = (tabId: string) => {
    const tab = session.findTab(tabId)?.tab
    if (!tab) {
      return
    }
    for (const view of viewsOf(session, tab.viewIds)) {
      session.removeView(view)
    }
    session.closeTab(tabId)
  }

  return (
    <div className={classes.container} data-testid="workspace">
      <LayoutRenderer
        node={session.tree}
        layout={session}
        drag={drag}
        chrome={{
          dragHandlers,
          onTabClose: closeTab,
          renderPanelActions: panel => (
            <WorkspacePanelActions panel={panel} session={session} />
          ),
          renderTabLabel: tab => (
            <WorkspaceTab
              tab={tab}
              views={viewsOf(session, tab.viewIds)}
              session={session}
              layout={session}
              onClose={() => {
                closeTab(tab.id)
              }}
            />
          ),
          renderTabContent: tab => {
            const views = viewsOf(session, tab.viewIds)
            return views.length > 0 ? (
              <div className={classes.stack}>
                <ViewStack views={views} session={session} />
              </div>
            ) : (
              <div className={classes.empty}>
                <Suspense fallback={null}>
                  <ViewLauncher session={session} />
                </Suspense>
              </div>
            )
          },
        }}
      />
    </div>
  )
})

// `session.views` is the one ordering of views, in both layout modes, so a
// tab's membership list is filtered through it rather than read as an order.
function viewsOf(session: WorkspaceSession, viewIds: string[]) {
  const members = new Set(viewIds)
  return session.views.filter(v => members.has(v.id))
}
