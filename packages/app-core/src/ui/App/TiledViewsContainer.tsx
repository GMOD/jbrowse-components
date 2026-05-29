import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { createElementId } from '@jbrowse/core/util/types/mst'
import { useTheme } from '@mui/material'
import { DockviewReact } from 'dockview-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { DockviewContext } from './DockviewContext.tsx'
import DockviewLeftHeaderActions from './DockviewLeftHeaderActions.tsx'
import DockviewRightHeaderActions from './DockviewRightHeaderActions.tsx'
import JBrowseViewPanel from './JBrowseViewPanel.tsx'
import JBrowseViewTab from './JBrowseViewTab.tsx'
import {
  applyInitLayout,
  cleanLayoutForStorage,
  createPanelConfig,
  getPanelPosition,
  updatePanelParams,
} from './dockviewUtils.ts'

import type { DockviewSessionType } from './types.ts'
import type { SessionWithDockviewLayout } from '../../DockviewLayout/index.ts'
import type {
  DockviewApi,
  DockviewGroupPanel,
  DockviewReadyEvent,
} from 'dockview-react'

const useStyles = makeStyles()(() => ({
  container: {
    height: '100%',
    width: '100%',
    gridRow: 'components',
  },
}))

interface Props {
  session: DockviewSessionType & SessionWithDockviewLayout
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
      session.setActivePanelId(panelId)
    },
    [api, session],
  )

  const moveViewToPanel = useCallback(
    (viewId: string, direction?: 'right') => {
      if (!api) {
        return
      }

      session.removeViewFromPanel(viewId)

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

  const contextValue = useMemo(
    () => ({
      api,
      rearrangePanels,
      addEmptyTab,
      moveViewToNewTab: moveViewToPanel,
      moveViewToSplitRight: (viewId: string) => {
        moveViewToPanel(viewId, 'right')
      },
    }),
    [api, rearrangePanels, addEmptyTab, moveViewToPanel],
  )

  const createInitialPanels = useCallback((dockviewApi: DockviewApi) => {
    const session = sessionRef.current
    const pendingAction = session.pendingMove

    // Handle layout from URL params
    const { init: initLayout } = session

    if (initLayout) {
      const firstPanelId = applyInitLayout(dockviewApi, session, initLayout)

      session.setInit(undefined)
      if (firstPanelId) {
        session.setActivePanelId(firstPanelId)
        dockviewApi.getPanel(firstPanelId)?.api.setActive()
      }
      session.setDockviewLayout(cleanLayoutForStorage(dockviewApi.toJSON()))
      return
    }

    // Clear any stale panel assignments from a previous mount
    for (const panelId of session.panelViewAssignments.keys()) {
      session.removePanel(panelId)
    }

    const pendingViewExists =
      pendingAction && session.views.some(v => v.id === pendingAction.viewId)

    if (pendingViewExists) {
      const { type, viewId: pendingViewId } = pendingAction
      const otherViewIds = session.views
        .map(v => v.id)
        .filter(id => id !== pendingViewId)

      let firstGroup: DockviewGroupPanel | undefined
      if (otherViewIds.length > 0) {
        const firstPanelId = `panel-${createElementId()}`
        dockviewApi.addPanel(createPanelConfig(firstPanelId, session))
        firstGroup = dockviewApi.getPanel(firstPanelId)?.group
        for (const viewId of otherViewIds) {
          session.assignViewToPanel(firstPanelId, viewId)
        }
      }

      const pendingPanelId = `panel-${createElementId()}`
      const direction = type === 'splitRight' ? 'right' : undefined
      dockviewApi.addPanel({
        ...createPanelConfig(pendingPanelId, session, 'New Tab'),
        position: getPanelPosition(firstGroup, direction),
      })
      session.assignViewToPanel(pendingPanelId, pendingViewId)
      session.setActivePanelId(pendingPanelId)

      // Save layout synchronously so React Strict Mode's second onReady sees it.
      // dockview's onDidLayoutChange fires asynchronously, so without this the
      // second mount would find dockviewLayout still undefined and fall back to
      // creating a single panel instead of restoring the split.
      session.setDockviewLayout(cleanLayoutForStorage(dockviewApi.toJSON()))

      session.setPendingMove(undefined)
    } else {
      const panelId = `panel-${createElementId()}`
      dockviewApi.addPanel(createPanelConfig(panelId, session))
      session.setActivePanelId(panelId)
      session.setDockviewLayout(cleanLayoutForStorage(dockviewApi.toJSON()))
    }
  }, [])

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      setApi(event.api)

      event.api.onDidActivePanelChange(e => {
        if (e?.id) {
          sessionRef.current.setActivePanelId(e.id)
        }
      })

      event.api.onDidRemovePanel(e => {
        if (!rearrangingRef.current) {
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
        if (!rearrangingRef.current) {
          sessionRef.current.setDockviewLayout(
            cleanLayoutForStorage(event.api.toJSON()),
          )
        }
      })

      const hasPendingAction = sessionRef.current.pendingMove !== undefined
      const savedLayout = !hasPendingAction && sessionRef.current.dockviewLayout

      if (savedLayout) {
        try {
          rearrangingRef.current = true
          event.api.fromJSON(savedLayout)
          updatePanelParams(event.api, sessionRef.current)
          if (event.api.panels.length === 0) {
            throw new Error('No panels after fromJSON restore')
          }
        } catch (e) {
          console.error('Failed to restore dockview layout:', e)
          createInitialPanels(event.api)
        } finally {
          rearrangingRef.current = false
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

      for (const view of views) {
        if (!session.getPanelContainingView(view.id)) {
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

      const assignedViewIds = [...session.panelViewAssignments.values()].flat()
      for (const id of assignedViewIds) {
        if (!currentViewIds.has(id)) {
          session.removeViewFromPanel(id)
        }
      }
    })

    return dispose
  }, [session, api])

  // React to layout changes from undo/redo
  useEffect(() => {
    if (!api) {
      return
    }

    const dispose = autorun(() => {
      const { dockviewLayout } = session
      if (!dockviewLayout || rearrangingRef.current) {
        return
      }

      const currentLayout = cleanLayoutForStorage(api.toJSON())
      if (JSON.stringify(currentLayout) === JSON.stringify(dockviewLayout)) {
        return
      }

      rearrangingRef.current = true
      try {
        api.fromJSON(dockviewLayout)
        updatePanelParams(api, sessionRef.current)
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
