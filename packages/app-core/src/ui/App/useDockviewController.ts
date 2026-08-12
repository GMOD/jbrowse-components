import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { autorun, observable, runInAction } from 'mobx'

import {
  adoptSavedPanelOrder,
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
  DockviewOrigin,
  DockviewReadyEvent,
  SerializedDockview,
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
  const sessionRef = useRef(session)
  sessionRef.current = session

  // Who caused the mutation dockview is currently inside, or undefined between
  // mutations. dockview tags everything entered through DockviewApi as 'api'
  // and every user gesture as 'user', and brackets each top-level mutation with
  // onWillMutateLayout/onDidMutateLayout — so "is this remove the user closing
  // a tab, or us restructuring the grid?" is a question the library answers.
  //
  // This replaced a try/finally flag we set around our own calls. The flag was
  // not wrong, it was unenforceable: nothing made a new restructure remember to
  // wrap itself, and a forgotten wrap silently closes the user's views. Reading
  // the origin cannot be forgotten, and it is correct for compound operations
  // (a drag that relocates a panel is one mutation, not three) because dockview
  // joins nested mutations into the outermost bracket.
  //
  // `undefined` also means "no mutation in flight", which is the second thing
  // this ref is for — see the sync autorun, which refuses to run while one is.
  const mutationOriginRef = useRef<DockviewOrigin | undefined>(undefined)

  // Set by the sync autorun so the end of a mutation can restart a run that
  // deferred. A ref because the two live in different closures: the bracket is
  // subscribed once in onReady, the autorun is rebuilt whenever `api` changes.
  const resumeSyncRef = useRef<(() => void) | undefined>(undefined)

  const rearrangePanels = useCallback(
    (arrange: (api: DockviewApi) => void) => {
      if (api) {
        arrange(api)
      }
    },
    [api],
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
    for (const panelId of session.panelViewAssignments.keys()) {
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
      // no-op at mount; on a later init it retires the panels being replaced.
      // Its removals carry origin 'api', so onDidRemovePanel leaves the views
      // alone without this call having to announce itself.
      dockviewApi.clear()

      const firstPanelId = applyInitLayout(dockviewApi, session, initLayout)
      session.setInit(undefined)
      if (firstPanelId) {
        session.setActivePanelId(firstPanelId)
        dockviewApi.getPanel(firstPanelId)?.api.setActive()
      }
      session.setDockviewLayout(dockviewApi.toJSON())
    },
    [clearPanelAssignments],
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

      // Bracket every top-level mutation with who asked for it. Nested calls
      // join the outermost, so this is set once per user-visible operation and
      // is live for every panel event fired inside it.
      event.api.onWillMutateLayout(e => {
        mutationOriginRef.current = e.origin
      })
      event.api.onDidMutateLayout(() => {
        mutationOriginRef.current = undefined
        // The mutation is over but this is still the emitter announcing that,
        // so dockview is mid-dispatch and a fresh mutation started from here
        // would nest inside the listener loop. A microtask puts the deferred
        // work on an empty stack, which is the whole point of deferring it.
        queueMicrotask(() => {
          resumeSyncRef.current?.()
        })
      })

      // Only a user activating a panel is news. Our own addPanel/fromJSON
      // activate one too, and writing that back is how the sync autorun ended
      // up re-entered from inside dockview's still-running emitter — every
      // path that calls the api sets activePanelId itself, in its own action,
      // where it is a deliberate edit rather than an echo.
      event.api.onDidActivePanelChange(e => {
        if (e.origin === 'user' && e.panel?.id) {
          sessionRef.current.setActivePanelId(e.panel.id)
        }
      })

      event.api.onDidRemovePanel(e => {
        if (mutationOriginRef.current !== 'api') {
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
        try {
          event.api.fromJSON(dockviewLayout)
          if (event.api.panels.length === 0) {
            throw new Error('No panels after fromJSON restore')
          }
          // Only on this path, and only here: a restore is the one moment a
          // session's saved panel order can disagree with session.views. The
          // undo path below restores both from one snapshot, where they
          // already agree, and writing to the session there is what the
          // TimeTraveller cannot tell from a fresh edit.
          adoptSavedPanelOrder(sessionRef.current)
        } catch (e) {
          console.error('Failed to restore dockview layout:', e)
          createInitialPanels(event.api)
        }
      } else {
        createInitialPanels(event.api)
      }
    },
    [createInitialPanels],
  )

  // The layout this autorun last saw on the session, so step 2 below can ask
  // whether the session's layout moved rather than whether dockview disagrees
  // with it. Not state: nothing renders from it.
  const lastSeenLayoutRef = useRef<SerializedDockview | undefined>(undefined)

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

    // Nothing here may touch dockview while dockview is mid-mutation, and this
    // autorun lands there routinely: dockview's panel events are synchronous,
    // our handlers for them write to the session, and an MST action flushes
    // reactions the moment it returns. So a user closing a tab can arrive here
    // from inside `_doRemovePanel`, and `fromJSON`/`clear` would then dispose
    // groups whose events are still being dispatched — which is the shape of
    // "invalid operation: resource is already disposed" — while `addPanel`
    // re-enters an add already in flight.
    //
    // Rather than argue each caller safe, refuse to run there at all. A
    // deferred run is restarted by `resumeSyncRef` on a microtask once dockview
    // is out, and `resumeTick` is what lets an autorun re-run on demand.
    //
    // This is the invariant, not an optimization: the origin filter and the
    // lastSeenLayout comparison each remove a *reason* to re-enter, and both
    // still earn their keep, but only this makes re-entering impossible. The
    // case it covers that they do not: a user gesture whose session write makes
    // some *other* model set `init` — `setPendingMove` is public API precisely
    // so plugins can do that — which had applyInit calling `api.clear()` inside
    // the user's own close. That was surviving on the accident that
    // `clearPanelAssignments` runs first and empties the assignments the
    // remove handler would have read.
    const resumeTick = observable.box(0)
    let deferred = false
    resumeSyncRef.current = () => {
      if (deferred) {
        deferred = false
        runInAction(() => {
          resumeTick.set(resumeTick.get() + 1)
        })
      }
    }

    const disposeAutorun = autorun(() => {
      resumeTick.get()
      const { init: initLayout, dockviewLayout } = session
      if (mutationOriginRef.current !== undefined) {
        deferred = true
        return
      }
      // After the guard, never before: recording a layout we then declined to
      // apply is how an undo gets swallowed.
      const lastSeenLayout = lastSeenLayoutRef.current
      lastSeenLayoutRef.current = dockviewLayout
      if (initLayout) {
        applyInit(api, initLayout)
      } else if (
        // Step 2 has exactly one caller — undo rewinding `dockviewLayout`
        // through applySnapshot — so it asks whether the SESSION's layout
        // moved. "does dockview disagree with the session?" is a different
        // question, and answering that one is what broke: dockview legitimately
        // disagrees for the whole window between an imperative mutation and the
        // AsapEvent microtask that persists it, so anything re-entering this
        // autorun during that window reverted the change the user just made,
        // and did it from inside dockview's own emitter — fromJSON disposing
        // groups mid-fire, "invalid operation: resource is already disposed".
        //
        // Filtering onDidActivePanelChange on origin removed the re-entry this
        // autorun's own api calls caused. It cannot remove all of them: a user
        // gesture that writes to the session (a drag, a close) is a mutation in
        // flight too, and that write is one we do want. So the guard stays, and
        // it is the one that makes step 2 safe rather than merely quiet.
        dockviewLayout &&
        !layoutsEqual(dockviewLayout, lastSeenLayout) &&
        !layoutsEqual(api.toJSON(), dockviewLayout)
      ) {
        try {
          api.fromJSON(dockviewLayout)
        } catch (e) {
          console.error('Failed to restore dockview layout from undo:', e)
        }
      }
      reconcilePanelAssignments(api, session)
    })

    return () => {
      resumeSyncRef.current = undefined
      disposeAutorun()
    }
  }, [session, api, applyInit])

  return { contextValue, onReady }
}
