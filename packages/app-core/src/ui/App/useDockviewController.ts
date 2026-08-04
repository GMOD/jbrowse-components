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

import type {
  DockviewLayoutNode,
  SessionWithDockviewLayout,
} from '../../DockviewLayout/index.ts'
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

  // Wipe panel assignments before building panels from scratch. Fresh panel ids
  // are about to be minted, so an assignment naming an old one either strands
  // its view (no panel renders it) or — since assignViewToPanel doesn't
  // unassign — double-renders it in two panels at once.
  const clearPanelAssignments = useCallback((session: DockviewSession) => {
    for (const panelId of [...session.panelViewAssignments.keys()]) {
      session.removePanel(panelId)
    }
  }, [])

  // Build the panels session.init asks for, replacing whatever dockview shows,
  // and consume the request. Called both at mount and afterwards: a session
  // spec's `layout` lands well after the first view does (views launch one
  // awaited handler at a time), so for a visitor whose workspaces preference is
  // already on the container has long since mounted by then. Reading init only
  // in onReady dropped exactly those layouts on the floor.
  const applyInit = useCallback(
    (dockviewApi: DockviewApi, initLayout: DockviewLayoutNode) => {
      const session = sessionRef.current
      clearPanelAssignments(session)
      // no-op at mount; on a later init it retires the panels being replaced
      withSuppressedPanelRemoval(() => {
        dockviewApi.clear()
      })

      const firstPanelId = applyInitLayout(dockviewApi, session, initLayout)
      session.setInit(undefined)
      if (firstPanelId) {
        session.setActivePanelId(firstPanelId)
        dockviewApi.getPanel(firstPanelId)?.api.setActive()
      }
      session.setDockviewLayout(dockviewApi.toJSON())
    },
    [clearPanelAssignments, withSuppressedPanelRemoval],
  )

  const createInitialPanels = useCallback(
    (dockviewApi: DockviewApi) => {
      const session = sessionRef.current
      clearPanelAssignments(session)

      const panelId = createPanelId()
      dockviewApi.addPanel(createPanelConfig(panelId))
      session.setActivePanelId(panelId)
      // Saved synchronously so React Strict Mode's second onReady sees it:
      // onDidLayoutChange lands on a microtask, so without this the second
      // mount would find dockviewLayout still undefined and start over.
      session.setDockviewLayout(dockviewApi.toJSON())
    },
    [clearPanelAssignments],
  )

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

      const { init: initLayout, dockviewLayout } = sessionRef.current

      // A pending `init` outranks the saved layout — it is the newer request —
      // and building it is the sync autorun's job, at mount and after alike, so
      // there is nothing to do here but stay out of its way.
      if (initLayout) {
        return
      }

      if (dockviewLayout) {
        withSuppressedPanelRemoval(() => {
          try {
            event.api.fromJSON(dockviewLayout)
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
  //   1. build the panels a pending `init` asks for (a spec layout, or "move
  //      this view to a tab/split" arriving from the classic stack)
  //   2. otherwise re-apply the persisted layout when it changes out from
  //      under dockview (undo/redo rewinds it through applySnapshot)
  //   3. reconcile panel<->view assignments against the panels that leaves
  // One autorun rather than three, because each step reads the panel set the
  // one before it installs. As separate reactions an undo runs 2 and 3 in the
  // wrong order: reconcile fires first, judges the restored assignments against
  // the panels undo is about to replace, and prunes every one of them as dead.
  useEffect(() => {
    if (!api) {
      return undefined
    }
    return autorun(() => {
      const { init: initLayout, dockviewLayout } = session
      if (initLayout) {
        applyInit(api, initLayout)
      } else if (
        dockviewLayout &&
        !layoutsEqual(api.toJSON(), dockviewLayout)
      ) {
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
  }, [session, api, applyInit, withSuppressedPanelRemoval])

  return { contextValue, onReady }
}
