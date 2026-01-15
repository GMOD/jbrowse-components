import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { nanoid } from '@jbrowse/core/util/nanoid'
import { makeStyles } from '@jbrowse/core/util/tss-react'
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
      const panelId = `panel-${nanoid()}`
      const group = targetGroup ?? api.activeGroup
      api.addPanel({
        ...createPanelConfig(panelId, session, 'New Tab'),
        position: group ? { referenceGroup: group } : undefined,
      })

      if (isSessionWithDockviewLayout(session)) {
        session.setActivePanelId(panelId)
      }
    },
    [api, session],
  )

  const moveViewToNewTab = useCallback(
    (viewId: string) => {
      if (!api || !isSessionWithDockviewLayout(session)) {
        console.log('[moveViewToNewTab] Early return - api:', !!api, 'isSessionWithDockviewLayout:', isSessionWithDockviewLayout(session))
        return
      }

      console.log('[moveViewToNewTab] Moving view:', viewId)
      console.log('[moveViewToNewTab] Current panels:', api.panels.map(p => p.id))
      console.log('[moveViewToNewTab] Current panelViewAssignments:', JSON.stringify([...session.panelViewAssignments.entries()]))

      // Remove view from current panel
      session.removeViewFromPanel(viewId)
      console.log('[moveViewToNewTab] After removeViewFromPanel:', JSON.stringify([...session.panelViewAssignments.entries()]))

      // Create new panel and assign the view to it
      const panelId = `panel-${nanoid()}`
      const group = api.activeGroup
      console.log('[moveViewToNewTab] Creating panel:', panelId, 'in group:', group?.id)

      api.addPanel({
        ...createPanelConfig(panelId, session, 'New Tab'),
        position: group ? { referenceGroup: group } : undefined,
      })
      session.assignViewToPanel(panelId, viewId)
      session.setActivePanelId(panelId)

      console.log('[moveViewToNewTab] Final panels:', api.panels.map(p => p.id))
      console.log('[moveViewToNewTab] Final panelViewAssignments:', JSON.stringify([...session.panelViewAssignments.entries()]))
    },
    [api, session],
  )

  const moveViewToSplitRight = useCallback(
    (viewId: string) => {
      if (!api || !isSessionWithDockviewLayout(session)) {
        return
      }
      // Remove view from current panel
      session.removeViewFromPanel(viewId)

      // Create new panel to the right of the current group
      const panelId = `panel-${nanoid()}`
      const group = api.activeGroup
      api.addPanel({
        ...createPanelConfig(panelId, session, 'New Tab'),
        position: group
          ? { referenceGroup: group, direction: 'right' }
          : undefined,
      })
      session.assignViewToPanel(panelId, viewId)
      session.setActivePanelId(panelId)
    },
    [api, session],
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
      for (const panelId of [...session.panelViewAssignments.keys()]) {
        session.removePanel(panelId)
      }
      session.setDockviewLayout(undefined)
    }
    trackedViewIdsRef.current.clear()

    // Only handle pending action if the view actually exists in session.views
    // This handles React StrictMode double-mounting and ensures we have all views
    const pendingViewExists =
      pendingAction && session.views.some(v => v.id === pendingAction.viewId)

    console.log('[createInitialPanels] Starting with', session.views.length, 'views, pendingAction:', pendingAction, 'pendingViewExists:', pendingViewExists)

    if (pendingViewExists && isSessionWithDockviewLayout(session)) {
      // Create correct panel structure upfront when there's a pending move action
      const { type, viewId: pendingViewId } = pendingAction
      const otherViewIds = session.views
        .map(v => v.id)
        .filter(id => id !== pendingViewId)

      // Create first panel for existing views (excluding the pending view)
      const firstPanelId = `panel-${nanoid()}`
      dockviewApi.addPanel(createPanelConfig(firstPanelId, session))
      for (const viewId of otherViewIds) {
        session.assignViewToPanel(firstPanelId, viewId)
        trackedViewIdsRef.current.add(viewId)
      }

      // Create second panel for the pending view
      const secondPanelId = `panel-${nanoid()}`
      const direction = type === 'splitRight' ? 'right' : undefined
      dockviewApi.addPanel({
        ...createPanelConfig(secondPanelId, session, 'New Tab'),
        position: direction
          ? { referenceGroup: dockviewApi.activeGroup!, direction }
          : { referenceGroup: dockviewApi.activeGroup! },
      })
      session.assignViewToPanel(secondPanelId, pendingViewId)
      trackedViewIdsRef.current.add(pendingViewId)
      session.setActivePanelId(secondPanelId)

      // Only clear the pending action after successful setup
      clearPendingMoveAction()

      console.log('[createInitialPanels] Created panels for pending action:', {
        firstPanelId,
        secondPanelId,
        otherViewIds,
        pendingViewId,
      })
    } else {
      // Normal case: create single initial panel
      const panelId = `panel-${nanoid()}`
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
      const canRestoreLayout =
        isSessionWithDockviewLayout(sessionRef.current) &&
        sessionRef.current.dockviewLayout &&
        !hasPendingAction

      if (canRestoreLayout) {
        try {
          rearrangingRef.current = true
          event.api.fromJSON(sessionRef.current.dockviewLayout!)
          updatePanelParams(event.api, sessionRef.current)

          for (const viewIds of sessionRef.current.panelViewAssignments.values()) {
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
        console.log('[autorun] No api yet, skipping')
        return
      }

      const { views } = session
      const currentViewIds = new Set(views.map(v => v.id))
      const trackedIds = trackedViewIdsRef.current

      console.log('[autorun] Running with', views.length, 'views, tracked:', trackedIds.size)

      for (const view of views) {
        if (!trackedIds.has(view.id)) {
          trackedIds.add(view.id)
          console.log('[autorun] New view to assign:', view.id)

          if (isSessionWithDockviewLayout(session)) {
            let activePanelId = session.activePanelId
            if (!activePanelId || !api.getPanel(activePanelId)) {
              const firstPanel = api.panels[0]
              if (firstPanel) {
                activePanelId = firstPanel.id
              } else {
                activePanelId = `panel-${nanoid()}`
                api.addPanel(createPanelConfig(activePanelId, session))
              }
              session.setActivePanelId(activePanelId)
            }
            console.log('[autorun] Assigning view', view.id, 'to panel', activePanelId)
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

      console.log('[autorun] Done. Assignments:', JSON.stringify([...session.panelViewAssignments.entries()]))
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
