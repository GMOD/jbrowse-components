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
  direction?: 'right' | 'below',
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
  const trackedViewIdsRef = useRef(new Set<string>())
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
    const pendingAction = peekPendingMoveAction()

    // Handle layout from URL params
    const initLayout = isSessionWithDockviewLayout(session)
      ? session.init
      : undefined

    if (initLayout && isSessionWithDockviewLayout(session)) {
      const dockSession = session
      trackedViewIdsRef.current.clear()
      let firstPanelId: string | undefined

      const groupSizes: { group: DockviewGroupPanel; size: number }[] = []

      function processNode(
        node: typeof initLayout,
        referenceGroup: DockviewGroupPanel | undefined,
        direction: 'right' | 'below' | undefined,
      ): DockviewGroupPanel | undefined {
        if (!node) {
          return undefined
        }
        if (node.viewIds !== undefined) {
          const panelId = `panel-${createElementId()}`
          if (!firstPanelId) {
            firstPanelId = panelId
          }
          const position =
            referenceGroup && direction
              ? { referenceGroup, direction }
              : referenceGroup
                ? { referenceGroup }
                : undefined
          dockviewApi.addPanel({
            ...createPanelConfig(panelId, session, 'Tab'),
            position,
          })
          for (const viewId of node.viewIds) {
            dockSession.assignViewToPanel(panelId, viewId)
            trackedViewIdsRef.current.add(viewId)
          }
          const group = dockviewApi.getPanel(panelId)?.group
          if (group && node.size !== undefined) {
            groupSizes.push({ group, size: node.size })
          }
          return group
        }
        if (node.children && node.children.length > 0) {
          const dockviewDirection =
            node.direction === 'horizontal' ? 'right' : 'below'
          let currentGroup = referenceGroup
          for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i]!
            const childDirection = i === 0 ? direction : dockviewDirection
            const childRef = i === 0 ? referenceGroup : currentGroup
            const newGroup = processNode(child, childRef, childDirection)
            if (newGroup) {
              currentGroup = newGroup
            }
          }
          return currentGroup
        }
        return undefined
      }

      processNode(initLayout, undefined, undefined)

      if (
        groupSizes.length >= 2 &&
        initLayout.direction &&
        groupSizes.length === initLayout.children?.length
      ) {
        const direction = initLayout.direction
        requestAnimationFrame(() => {
          const totalSize = groupSizes.reduce((sum, g) => sum + g.size, 0)
          if (totalSize > 0) {
            if (direction === 'horizontal') {
              const containerWidth = dockviewApi.width
              if (containerWidth > 0) {
                for (const { group, size } of groupSizes) {
                  const width = Math.round(containerWidth * (size / totalSize))
                  group.api.setSize({ width })
                }
              }
            } else {
              const containerHeight = dockviewApi.height
              if (containerHeight > 0) {
                for (const { group, size } of groupSizes) {
                  const height = Math.round(
                    containerHeight * (size / totalSize),
                  )
                  group.api.setSize({ height })
                }
              }
            }
          }
        })
      }

      session.setInit(undefined)
      if (firstPanelId) {
        session.setActivePanelId(firstPanelId)
        dockviewApi.getPanel(firstPanelId)?.api.setActive()
      }
      session.setDockviewLayout(cleanLayoutForStorage(dockviewApi.toJSON()))
      return
    }

    // Clear any stale panel assignments from a previous mount
    if (isSessionWithDockviewLayout(session)) {
      for (const panelId of session.panelViewAssignments.keys()) {
        session.removePanel(panelId)
      }
    }
    trackedViewIdsRef.current.clear()

    const pendingViewExists =
      pendingAction && session.views.some(v => v.id === pendingAction.viewId)

    if (pendingViewExists && isSessionWithDockviewLayout(session)) {
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
          trackedViewIdsRef.current.add(viewId)
        }
      }

      const pendingPanelId = `panel-${createElementId()}`
      const direction = type === 'splitRight' ? 'right' : undefined
      dockviewApi.addPanel({
        ...createPanelConfig(pendingPanelId, session, 'New Tab'),
        position: getPanelPosition(firstGroup, direction),
      })
      session.assignViewToPanel(pendingPanelId, pendingViewId)
      trackedViewIdsRef.current.add(pendingViewId)
      session.setActivePanelId(pendingPanelId)

      // Save layout synchronously so React Strict Mode's second onReady sees it.
      // dockview's onDidLayoutChange fires asynchronously, so without this the
      // second mount would find dockviewLayout still undefined and fall back to
      // creating a single panel instead of restoring the split.
      session.setDockviewLayout(cleanLayoutForStorage(dockviewApi.toJSON()))

      clearPendingMoveAction()
    } else {
      const panelId = `panel-${createElementId()}`
      dockviewApi.addPanel(createPanelConfig(panelId, session))

      if (isSessionWithDockviewLayout(session)) {
        session.setActivePanelId(panelId)
        session.setDockviewLayout(cleanLayoutForStorage(dockviewApi.toJSON()))
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

      const hasPendingAction = peekPendingMoveAction() !== null
      const dockviewSession = isSessionWithDockviewLayout(sessionRef.current)
        ? sessionRef.current
        : null
      const savedLayout = !hasPendingAction && dockviewSession?.dockviewLayout

      if (savedLayout) {
        try {
          rearrangingRef.current = true
          event.api.fromJSON(savedLayout)
          updatePanelParams(event.api, dockviewSession)
          for (const viewIds of dockviewSession.panelViewAssignments.values()) {
            for (const viewId of viewIds) {
              trackedViewIdsRef.current.add(viewId)
            }
          }
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

      const currentLayout = cleanLayoutForStorage(api.toJSON())
      if (JSON.stringify(currentLayout) === JSON.stringify(dockviewLayout)) {
        return
      }

      rearrangingRef.current = true
      try {
        api.fromJSON(dockviewLayout)
        updatePanelParams(api, sessionRef.current)

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
