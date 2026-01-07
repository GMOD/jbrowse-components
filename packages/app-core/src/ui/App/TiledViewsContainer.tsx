import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { nanoid } from '@jbrowse/core/util/nanoid'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useTheme } from '@mui/material'
import { DockviewReact } from 'dockview-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { DockviewContext, getPendingMoveAction } from './DockviewContext.tsx'
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
        return
      }
      // Remove view from current panel
      session.removeViewFromPanel(viewId)

      // Create new panel and assign the view to it
      const panelId = `panel-${nanoid()}`
      const group = api.activeGroup
      api.addPanel({
        ...createPanelConfig(panelId, session, 'New Tab'),
        position: group ? { referenceGroup: group } : undefined,
      })
      session.assignViewToPanel(panelId, viewId)
      session.setActivePanelId(panelId)
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

  const createInitialPanel = useCallback((dockviewApi: DockviewApi) => {
    const panelId = `panel-${nanoid()}`
    dockviewApi.addPanel(createPanelConfig(panelId, sessionRef.current))

    if (isSessionWithDockviewLayout(sessionRef.current)) {
      sessionRef.current.setActivePanelId(panelId)
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

      if (
        isSessionWithDockviewLayout(sessionRef.current) &&
        sessionRef.current.dockviewLayout
      ) {
        try {
          rearrangingRef.current = true
          event.api.fromJSON(sessionRef.current.dockviewLayout)
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
          createInitialPanel(event.api)
        }
      } else {
        createInitialPanel(event.api)
      }
    },
    [createInitialPanel],
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
                activePanelId = `panel-${nanoid()}`
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

  // Execute pending move action when api becomes defined. This handles the case
  // where user clicks "Move to new tab" before workspaces is enabled - the
  // action is stored as pending, then executed here once TiledViewsContainer
  // mounts and the dockview api is ready.
  useEffect(() => {
    if (!api) {
      return
    }
    const pendingAction = getPendingMoveAction()
    if (pendingAction) {
      const { type, viewId } = pendingAction
      if (type === 'newTab') {
        moveViewToNewTab(viewId)
      } else {
        moveViewToSplitRight(viewId)
      }
    }
  }, [api, moveViewToNewTab, moveViewToSplitRight])

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
