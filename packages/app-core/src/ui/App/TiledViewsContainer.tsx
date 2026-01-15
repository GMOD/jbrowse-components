import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { createElementId } from '@jbrowse/core/util/types/mst'
import { useTheme } from '@mui/material'
import { DockviewReact } from 'dockview-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import {
  DockviewContext,
  clearPendingMoveAction,
  peekPendingMoveAction,
} from './DockviewContext.tsx'
import DockviewLeftHeaderActions from './DockviewLeftHeaderActions.tsx'
import DockviewRightHeaderActions from './DockviewRightHeaderActions.tsx'
import JBrowseViewPanel from './JBrowseViewPanel.tsx'
import JBrowseViewTab from './JBrowseViewTab.tsx'
import {
  cleanLayoutForStorage,
  createPanelConfig,
  updatePanelParams,
} from './dockviewUtils.ts'
import { isSessionWithDockviewLayout } from '../../DockviewLayout/index.ts'

import type { DockviewSessionType } from './types.ts'
import type {
  DockviewApi,
  DockviewGroupPanel,
  DockviewReadyEvent,
} from 'dockview-react'

import 'dockview-react/dist/styles/dockview.css'

const useStyles = makeStyles()(() => ({
  container: {
    height: '100%',
    width: '100%',
    gridRow: 'components',
  },
}))

interface Props {
  session: DockviewSessionType
}

function getPanelPosition(
  group: DockviewGroupPanel | undefined,
  direction?: 'right',
) {
  if (!group) {
    return undefined
  }
  if (direction) {
    return { referenceGroup: group, direction }
  }
  return { referenceGroup: group }
}

const components = {
  jbrowseView: JBrowseViewPanel,
}

const tabComponents = {
  jbrowseTab: JBrowseViewTab,
}

const TiledViewsContainer = observer(function TiledViewsContainer({
  session,
}: Props) {
  const { classes } = useStyles()
  const theme = useTheme()
  const [api, setApi] = useState<DockviewApi | null>(null)
  const trackedViewIdsRef = useRef<Set<string>>(new Set())
  const rearrangingRef = useRef(false)
  const sessionRef = useRef(session)
  sessionRef.current = session

  const rearrangePanels = useCallback(
    (arrange: (api: DockviewApi) => void) => {
      if (!api) {
        return
      }
      rearrangingRef.current = true
      try {
        arrange(api)
      } finally {
        rearrangingRef.current = false
      }
    },
    [api],
  )

  const addEmptyTab = useCallback(
    (targetGroup?: DockviewGroupPanel) => {
      if (!api) {
        return
      }
      const panelId = `panel-${createElementId()}`
      const group = targetGroup ?? api.activeGroup
      api.addPanel({
        ...createPanelConfig(panelId, session, 'New Tab'),
        position: getPanelPosition(group),
      })

      if (isSessionWithDockviewLayout(session)) {
        session.setActivePanelId(panelId)
      }
    },
    [api, session],
  )

  const moveViewToPanel = useCallback(
    (viewId: string, direction?: 'right') => {
      if (!api || !isSessionWithDockviewLayout(session)) {
        return
      }

      // Remove view from current panel
      session.removeViewFromPanel(viewId)

      // Create new panel and assign the view to it
      const panelId = `panel-${createElementId()}`
      api.addPanel({
        ...createPanelConfig(panelId, session, 'New Tab'),
        position: getPanelPosition(api.activeGroup, direction),
      })
      session.assignViewToPanel(panelId, viewId)
      session.setActivePanelId(panelId)
    },
    [api, session],
  )

  const moveViewToNewTab = useCallback(
    (viewId: string) => {
      moveViewToPanel(viewId)
    },
    [moveViewToPanel],
  )

  const moveViewToSplitRight = useCallback(
    (viewId: string) => {
      moveViewToPanel(viewId, 'right')
    },
    [moveViewToPanel],
  )

  const contextValue = useMemo(
    () => ({
      api,
      rearrangePanels,
      addEmptyTab,
      moveViewToNewTab,
      moveViewToSplitRight,
    }),
    [api, rearrangePanels, addEmptyTab, moveViewToNewTab, moveViewToSplitRight],
  )

  const createInitialPanels = useCallback((dockviewApi: DockviewApi) => {
    const session = sessionRef.current
    const pendingAction = peekPendingMoveAction()

    // Clear any stale state from previous mounts (e.g., React StrictMode double-mounting)
    if (isSessionWithDockviewLayout(session)) {
      for (const panelId of session.panelViewAssignments.keys()) {
        session.removePanel(panelId)
      }
      session.setDockviewLayout(undefined)
    }
    trackedViewIdsRef.current.clear()

    // Only handle pending action if the view actually exists in session.views
    // This handles React StrictMode double-mounting and ensures we have all views
    const pendingViewExists =
      pendingAction && session.views.some(v => v.id === pendingAction.viewId)

    if (pendingViewExists && isSessionWithDockviewLayout(session)) {
      // Create correct panel structure upfront when there's a pending move action
      const { type, viewId: pendingViewId } = pendingAction
      const otherViewIds = session.views
        .map(v => v.id)
        .filter(id => id !== pendingViewId)

      // Create first panel for existing views (excluding the pending view)
      // Only create if there are other views to put in it
      if (otherViewIds.length > 0) {
        const firstPanelId = `panel-${createElementId()}`
        dockviewApi.addPanel(createPanelConfig(firstPanelId, session))
        for (const viewId of otherViewIds) {
          session.assignViewToPanel(firstPanelId, viewId)
          trackedViewIdsRef.current.add(viewId)
        }
      }

      // Create panel for the pending view
      const pendingPanelId = `panel-${createElementId()}`
      const direction = type === 'splitRight' ? 'right' : undefined
      dockviewApi.addPanel({
        ...createPanelConfig(pendingPanelId, session, 'New Tab'),
        position: getPanelPosition(dockviewApi.activeGroup, direction),
      })
      session.assignViewToPanel(pendingPanelId, pendingViewId)
      trackedViewIdsRef.current.add(pendingViewId)
      session.setActivePanelId(pendingPanelId)

      // Only clear the pending action after successful setup
      clearPendingMoveAction()
    } else {
      // Normal case: create single initial panel
      const panelId = `panel-${createElementId()}`
      dockviewApi.addPanel(createPanelConfig(panelId, session))

      if (isSessionWithDockviewLayout(session)) {
        session.setActivePanelId(panelId)
      }
    }
  }, [])

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      setApi(event.api)

      event.api.onDidActivePanelChange(e => {
        if (e?.id && isSessionWithDockviewLayout(sessionRef.current)) {
          sessionRef.current.setActivePanelId(e.id)
        }
      })

      event.api.onDidRemovePanel(e => {
        if (rearrangingRef.current) {
          return
        }
        if (isSessionWithDockviewLayout(sessionRef.current)) {
          const viewIds = sessionRef.current.getViewIdsForPanel(e.id)
          for (const viewId of viewIds) {
            const view = sessionRef.current.views.find(v => v.id === viewId)
            if (view) {
              sessionRef.current.removeView(view)
            }
          }
          sessionRef.current.removePanel(e.id)
        }
      })

      event.api.onDidLayoutChange(() => {
        if (
          !rearrangingRef.current &&
          isSessionWithDockviewLayout(sessionRef.current)
        ) {
          sessionRef.current.setDockviewLayout(
            cleanLayoutForStorage(event.api.toJSON()),
          )
        }
      })

      // If there's a pending move action, always create fresh panels to handle it
      // Otherwise, try to restore from saved layout if available
      const hasPendingAction = peekPendingMoveAction() !== null
      const dockviewSession = isSessionWithDockviewLayout(sessionRef.current)
        ? sessionRef.current
        : null
      const savedLayout = !hasPendingAction && dockviewSession?.dockviewLayout

      if (savedLayout && dockviewSession) {
        try {
          rearrangingRef.current = true
          event.api.fromJSON(savedLayout)
          updatePanelParams(event.api, dockviewSession)
          for (const viewIds of dockviewSession.panelViewAssignments.values()) {
            for (const viewId of viewIds) {
              trackedViewIdsRef.current.add(viewId)
            }
          }
          rearrangingRef.current = false
        } catch (e) {
          console.error('Failed to restore dockview layout:', e)
          rearrangingRef.current = false
          createInitialPanels(event.api)
        }
      } else {
        createInitialPanels(event.api)
      }
    },
    [createInitialPanels],
  )

  useEffect(() => {
    const dispose = autorun(() => {
      if (!api) {
        return
      }

      const { views } = session
      const currentViewIds = new Set(views.map(v => v.id))
      const trackedIds = trackedViewIdsRef.current

      for (const view of views) {
        if (!trackedIds.has(view.id)) {
          trackedIds.add(view.id)

          if (isSessionWithDockviewLayout(session)) {
            let activePanelId = session.activePanelId
            if (!activePanelId || !api.getPanel(activePanelId)) {
              const firstPanel = api.panels[0]
              if (firstPanel) {
                activePanelId = firstPanel.id
              } else {
                activePanelId = `panel-${createElementId()}`
                api.addPanel(createPanelConfig(activePanelId, session))
              }
              session.setActivePanelId(activePanelId)
            }
            session.assignViewToPanel(activePanelId, view.id)
          }
        }
      }

      for (const id of trackedIds) {
        if (!currentViewIds.has(id)) {
          trackedIds.delete(id)
          if (isSessionWithDockviewLayout(session)) {
            session.removeViewFromPanel(id)
          }
        }
      }
    })

    return dispose
  }, [session, api])

  // React to layout changes from undo/redo
  useEffect(() => {
    if (!api || !isSessionWithDockviewLayout(session)) {
      return
    }

    const dispose = autorun(() => {
      const { dockviewLayout } = session
      if (!dockviewLayout || rearrangingRef.current) {
        return
      }

      // Compare current dockview state with session state
      const currentLayout = cleanLayoutForStorage(api.toJSON())
      if (JSON.stringify(currentLayout) === JSON.stringify(dockviewLayout)) {
        return
      }

      // Layout differs - restore from session (likely from undo/redo)
      rearrangingRef.current = true
      try {
        api.fromJSON(dockviewLayout)
        updatePanelParams(api, sessionRef.current)

        // Rebuild tracked view IDs from restored layout
        trackedViewIdsRef.current.clear()
        for (const viewIds of session.panelViewAssignments.values()) {
          for (const viewId of viewIds) {
            trackedViewIdsRef.current.add(viewId)
          }
        }
      } catch (e) {
        console.error('Failed to restore dockview layout from undo:', e)
      } finally {
        rearrangingRef.current = false
      }
    })

    return dispose
  }, [session, api])

  const themeClass =
    theme.palette.mode === 'dark'
      ? 'dockview-theme-dark'
      : 'dockview-theme-light'

  return (
    <DockviewContext.Provider value={contextValue}>
      <div className={`${classes.container} ${themeClass}`}>
        <DockviewReact
          components={components}
          tabComponents={tabComponents}
          leftHeaderActionsComponent={DockviewLeftHeaderActions}
          rightHeaderActionsComponent={DockviewRightHeaderActions}
          onReady={onReady}
        />
      </div>
    </DockviewContext.Provider>
  )
})

export default TiledViewsContainer
