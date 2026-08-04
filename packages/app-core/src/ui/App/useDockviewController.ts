import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { autorun, runInAction } from 'mobx'

import {
  applyInitLayout,
  createPanelConfig,
  createPanelId,
  getPanelPosition,
  layoutsEqual,
  reconcilePanelAssignments,
} from './dockviewUtils.ts'

import type { SessionWithDockviewLayout } from '../../DockviewLayout/index.ts'
import type { DockviewContextValue } from './DockviewContext.tsx'
import type { DockviewSessionType } from './types.ts'
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
  const removingPanelsRef = useRef(false)
  const sessionRef = useRef(session)
  sessionRef.current = session

  // Run `fn` with the "a closed panel closes its views" rule turned off.
  // Removing a panel is how dockview expresses both "the user closed this tab"
  // and "I am restructuring the grid" (fromJSON clears every panel first, the
  // tile presets remove and re-add them), and only the first should reach
  // session.removeView. onDidRemovePanel fires synchronously, so a flag held
  // across the call is enough to tell them apart; the `finally` guarantees it
  // is always reset, so it can never get stuck on and eat a real close.
  const withSuppressedPanelRemoval = useCallback((fn: () => void) => {
    removingPanelsRef.current = true
    try {
      fn()
    } finally {
      removingPanelsRef.current = false
    }
  }, [])

  const rearrangePanels = useCallback(
    (arrange: (api: DockviewApi) => void) => {
      if (api) {
        withSuppressedPanelRemoval(() => {
          arrange(api)
        })
      }
    },
    [api, withSuppressedPanelRemoval],
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

    // Clear any stale panel assignments from a previous mount. Every branch
    // below mints fresh panel ids, so an assignment left over from the last
    // mount either strands its view (no panel renders it) or — since
    // assignViewToPanel doesn't unassign — double-renders it in two panels at
    // once. Hoisted above the `init` branch, which used to skip it.
    for (const panelId of [...session.panelViewAssignments.keys()]) {
      session.removePanel(panelId)
    }

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
        if (!removingPanelsRef.current) {
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

      // dockview fires this on a microtask (AsapEvent), so it also lands after
      // every layout we install ourselves — fromJSON on restore and on undo,
      // the tile presets — by which time any synchronous suppression flag is
      // long reset. Writing that echo back would count as a fresh session edit:
      // an undo would push its own re-serialization into the TimeTraveller
      // history 300ms later and truncate the redo stack. So compare first, and
      // only persist a layout dockview actually moved away from.
      event.api.onDidLayoutChange(() => {
        const layout = event.api.toJSON()
        if (!layoutsEqual(layout, sessionRef.current.dockviewLayout)) {
          sessionRef.current.setDockviewLayout(layout)
        }
      })

      const hasPendingAction = sessionRef.current.pendingMove !== undefined
      const savedLayout = !hasPendingAction && sessionRef.current.dockviewLayout

      if (savedLayout) {
        withSuppressedPanelRemoval(() => {
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
    [createInitialPanels, withSuppressedPanelRemoval],
  )

  // Keep dockview in step with the session, in this order:
  //   1. re-apply the persisted layout when it changes out from under dockview
  //      (undo/redo rewinds session.dockviewLayout through applySnapshot)
  //   2. reconcile panel<->view assignments against the panels that leaves
  // One autorun rather than two, because step 2 reads the panel set step 1
  // installs. As separate reactions an undo runs them in the wrong order:
  // reconcile fires first, judges the restored assignments against the panels
  // undo is about to replace, and prunes every one of them as dead.
  useEffect(() => {
    if (!api) {
      return undefined
    }
    return autorun(() => {
      const { dockviewLayout } = session
      if (dockviewLayout && !layoutsEqual(api.toJSON(), dockviewLayout)) {
        withSuppressedPanelRemoval(() => {
          try {
            api.fromJSON(dockviewLayout)
          } catch (e) {
            console.error('Failed to restore dockview layout from undo:', e)
          }
        })
      }
      reconcilePanelAssignments(api, session)
    })
  }, [session, api, withSuppressedPanelRemoval])

  return { contextValue, onReady }
}
