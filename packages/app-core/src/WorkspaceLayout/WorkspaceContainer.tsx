import { Suspense, lazy, useCallback, useEffect, useMemo } from 'react'

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
import type { PanelChrome } from './panelChrome.ts'

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
  const { drag, handlers } = useLayoutDrag(session)

  useEffect(
    () =>
      autorun(() => {
        // reads session.views itself, so it re-runs when the view set changes;
        // homeUnassignedViews is an action and would not be tracked from inside
        session.homeUnassignedViews(session.views.map(v => v.id))
      }),
    [session],
  )

  // The layout does not own views, so closing anything that holds them is
  // explicitly the pair. Stated ONCE, here, because every spelling of it is a
  // chance to drop the node and leave its views in the session forever — and
  // three gestures want it now: the tab's ⋮ menu, middle-clicking the tab, and
  // the cell's ×.
  const closeViews = useCallback(
    (viewIds: string[]) => {
      for (const view of viewsOf(session, viewIds)) {
        session.removeView(view)
      }
    },
    [session],
  )

  const closeTab = useCallback(
    (tabId: string) => {
      const tab = session.findTab(tabId)?.tab
      if (!tab) {
        return
      }
      closeViews(tab.viewIds)
      session.closeTab(tabId)
    },
    [session, closeViews],
  )

  const closePanel = useCallback(
    (panelId: string) => {
      const panel = session.panels.find(p => p.id === panelId)
      if (!panel) {
        return
      }
      closeViews(panel.tabs.flatMap(t => t.viewIds))
      session.closePanel(panelId)
    },
    [session, closeViews],
  )

  /**
   * Memoised because this reaches every panel, so a fresh one per render
   * defeats `observer`'s memo for all of them and each re-render rebuilds a
   * `ViewStack`. `drag` is deliberately NOT in here — it goes down its own prop
   * so it reaches only the cell it describes.
   *
   * Nothing does this for us: `observer(function(){})` is not compiled by the
   * React Compiler.
   */
  const chrome = useMemo<PanelChrome>(
    () => ({
      dragHandlers: handlers,
      onTabClose: closeTab,
      renderPanelActions: panel => (
        <WorkspacePanelActions
          panel={panel}
          session={session}
          onClose={() => {
            closePanel(panel.id)
          }}
        />
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
          <ViewStack
            views={views}
            session={session}
            className={classes.stack}
          />
        ) : (
          <div className={classes.empty}>
            <Suspense fallback={null}>
              <ViewLauncher session={session} />
            </Suspense>
          </div>
        )
      },
    }),
    [session, handlers, closeTab, closePanel, classes.stack, classes.empty],
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

// `session.views` is the one ordering of views, in both layout modes, so a
// tab's membership list is filtered through it rather than read as an order.
function viewsOf(session: WorkspaceSession, viewIds: string[]) {
  const members = new Set(viewIds)
  return session.views.filter(v => members.has(v.id))
}
