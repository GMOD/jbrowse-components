import { Suspense, useCallback, useEffect, useMemo } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import ViewStack from '../ui/App/ViewStack.tsx'
import { ViewLauncher } from '../ui/App/lazyParts.ts'
import { LayoutRenderer } from './LayoutRenderer.tsx'
import { WorkspacePanelActions } from './WorkspacePanelActions.tsx'
import { WorkspaceTab } from './WorkspaceTab.tsx'
import { useLayoutDrag } from './useLayoutDrag.ts'

import type { WorkspaceSessionType } from '../ui/App/types.ts'
import type { WorkspaceLayout } from './model.ts'
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

type WorkspaceSession = WorkspaceSessionType & WorkspaceLayout

export const WorkspaceContainer = observer(function WorkspaceContainer({
  session,
}: {
  session: WorkspaceSession
}) {
  const { classes } = useStyles()
  const { drag, handlers } = useLayoutDrag(session)

  // #region autorunInEffect
  useEffect(
    () =>
      autorun(() => {
        // homes newly launched views; reads session.views here because an
        // action's reads are untracked
        session.homeUnassignedViews(session.views.map(v => v.id))
      }),
    [session],
  )
  // #endregion

  // the layout does not own views, so every close gesture goes through here
  // or leaks them
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

  // memoised by hand (the React Compiler skips `observer`): a fresh object
  // re-renders every panel's ViewStack. `drag` stays out for the same reason.
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
    [session, handlers, closeTab, closePanel, classes.empty],
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
function viewsOf(session: WorkspaceSession, viewIds: string[]) {
  const members = new Set(viewIds)
  return session.views.filter(v => members.has(v.id))
}
