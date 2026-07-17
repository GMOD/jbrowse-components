import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { autorun, runInAction } from 'mobx'

import {
  applyInitLayout,
  createPanelConfig,
  createPanelId,
  getPanelPosition,
  reconcilePanelAssignments,
} from './dockviewUtils.ts'

import type { DockviewContextValue } from './DockviewContext.tsx'
import type { DockviewSessionType } from './types.ts'
import type { SessionWithDockviewLayout } from '../../DockviewLayout/index.ts'
import type {
  DockviewApi,
  DockviewGroupPanel,
  DockviewReadyEvent,
} from 'dockview-react'

type DockviewSession = DockviewSessionType & SessionWithDockviewLayout

/**
 * Owns the imperative bridge between the live MST session and the dockview api:
 * panel creation, the ViewMenu move actions exposed through DockviewContext, and
 * the autoruns that keep session <-> dockview in sync. TiledViewsContainer just
 * renders what this returns.
 */
export function useDockviewController(session: DockviewSession) {
  const [api, setApi] = useState<DockviewApi | null>(null)
  const rearrangingRef = useRef(false)
  const sessionRef = useRef(session)
  sessionRef.current = session

  // Run `fn` with layout->session syncing suppressed. dockview fires its
  // onDidLayoutChange/onDidRemovePanel listeners synchronously while we
  // imperatively rearrange panels; the flag tells those listeners to ignore
  // our own mutations. The `finally` guarantees the flag is always reset, so
  // it can never get stuck on (which would silently disable persistence).
  const withSuppressedSync = useCallback((fn: () => void) => {
    rearrangingRef.current = true
    try {
      fn()
    } finally {
      rearrangingRef.current = false
    }
  }, [])

  const rearrangePanels = useCallback(
    (arrange: (api: DockviewApi) => void) => {
      if (api) {
        withSuppressedSync(() => {
          arrange(api)
        })
      }
    },
    [api, withSuppressedSync],
  )

  const addEmptyTab = useCallback(
    (targetGroup?: DockviewGroupPanel) => {
      if (!api) {
        return
      }
      const panelId = createPanelId()
      const group = targetGroup ?? api.activeGroup
      api.addPanel({
        ...createPanelConfig(panelId),
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

      const panelId = createPanelId()
      api.addPanel({
        ...createPanelConfig(panelId),
        position: getPanelPosition(api.activeGroup, direction),
      })
      // Batch the unassign+reassign so the view-reconcile autorun only observes
      // the final state (view in the new panel). Without the batch it fires
      // right after removeViewFromPanel — sees the view unassigned and re-adds
      // it to activePanelId — leaving the view stacked in two panels at once.
      runInAction(() => {
        session.removeViewFromPanel(viewId)
        session.assignViewToPanel(panelId, viewId)
        session.setActivePanelId(panelId)
      })
    },
    [api, session],
  )

  const contextValue = useMemo<DockviewContextValue>(
    () => ({
      api,
      session,
      rearrangePanels,
      addEmptyTab,
      moveViewToNewTab: moveViewToPanel,
      moveViewToSplitRight: (viewId: string) => {
        moveViewToPanel(viewId, 'right')
      },
    }),
    [api, session, rearrangePanels, addEmptyTab, moveViewToPanel],
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
      session.setDockviewLayout(dockviewApi.toJSON())
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
      const otherViewIds = session.views.flatMap(v =>
        v.id === pendingViewId ? [] : [v.id],
      )

      let firstGroup: DockviewGroupPanel | undefined
      if (otherViewIds.length > 0) {
        const firstPanelId = createPanelId()
        dockviewApi.addPanel(createPanelConfig(firstPanelId))
        firstGroup = dockviewApi.getPanel(firstPanelId)?.group
        for (const viewId of otherViewIds) {
          session.assignViewToPanel(firstPanelId, viewId)
        }
      }

      const pendingPanelId = createPanelId()
      const direction = type === 'splitRight' ? 'right' : undefined
      dockviewApi.addPanel({
        ...createPanelConfig(pendingPanelId),
        position: getPanelPosition(firstGroup, direction),
      })
      session.assignViewToPanel(pendingPanelId, pendingViewId)
      session.setActivePanelId(pendingPanelId)

      // Save layout synchronously so React Strict Mode's second onReady sees it.
      // dockview's onDidLayoutChange fires asynchronously, so without this the
      // second mount would find dockviewLayout still undefined and fall back to
      // creating a single panel instead of restoring the split.
      session.setDockviewLayout(dockviewApi.toJSON())

      session.setPendingMove(undefined)
    } else {
      const panelId = createPanelId()
      dockviewApi.addPanel(createPanelConfig(panelId))
      session.setActivePanelId(panelId)
      session.setDockviewLayout(dockviewApi.toJSON())
    }
  }, [])

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      setApi(event.api)

      event.api.onDidActivePanelChange(e => {
        if (e.panel?.id) {
          sessionRef.current.setActivePanelId(e.panel.id)
        }
      })

      event.api.onDidRemovePanel(e => {
        if (!rearrangingRef.current) {
          const session = sessionRef.current
          for (const viewId of session.getViewIdsForPanel(e.id)) {
            const view = session.views.find(v => v.id === viewId)
            if (view) {
              session.removeView(view)
            }
          }
          session.removePanel(e.id)
        }
      })

      event.api.onDidLayoutChange(() => {
        if (!rearrangingRef.current) {
          sessionRef.current.setDockviewLayout(event.api.toJSON())
        }
      })

      const hasPendingAction = sessionRef.current.pendingMove !== undefined
      const savedLayout = !hasPendingAction && sessionRef.current.dockviewLayout

      if (savedLayout) {
        withSuppressedSync(() => {
          try {
            event.api.fromJSON(savedLayout)
            if (event.api.panels.length === 0) {
              throw new Error('No panels after fromJSON restore')
            }
          } catch (e) {
            console.error('Failed to restore dockview layout:', e)
            createInitialPanels(event.api)
          }
        })
      } else {
        createInitialPanels(event.api)
      }
    },
    [createInitialPanels, withSuppressedSync],
  )

  // Keep panel<->view assignments in sync: home any newly added view and drop
  // assignments for removed views, as session.views changes.
  useEffect(() => {
    if (!api) {
      return undefined
    }
    return autorun(() => {
      reconcilePanelAssignments(api, session)
    })
  }, [session, api])

  // Re-apply the persisted layout when it changes out from under dockview
  // (undo/redo rewinds session.dockviewLayout), ignoring our own edits.
  useEffect(() => {
    if (!api) {
      return undefined
    }
    return autorun(() => {
      const { dockviewLayout } = session
      if (!dockviewLayout || rearrangingRef.current) {
        return
      }

      const currentLayout = api.toJSON()
      if (JSON.stringify(currentLayout) === JSON.stringify(dockviewLayout)) {
        return
      }

      withSuppressedSync(() => {
        try {
          api.fromJSON(dockviewLayout)
        } catch (e) {
          console.error('Failed to restore dockview layout from undo:', e)
        }
      })
    })
  }, [session, api, withSuppressedSync])

  return { contextValue, onReady }
}
