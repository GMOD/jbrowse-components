import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { dropZoneAt, splitForZone, stripDropAt } from './dropZone.ts'

import type { DropTarget } from './dropZone.ts'
import type { WorkspaceLayout } from './model.ts'

export interface DragState extends DropTarget {
  tabId: string
  panelId: string
}

export interface TabDragHandlers {
  onTabPointerDown: (
    tabId: string,
    event: React.PointerEvent<HTMLElement>,
  ) => void
  onTabPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  onTabPointerUp: (event: React.PointerEvent<HTMLElement>) => void
  onTabPointerCancel: (event: React.PointerEvent<HTMLElement>) => void
}

/**
 * Two drags that would paint the same thing.
 *
 * The indicator is a function of the cell and the zone — or, on a strip, the gap
 * — and a pointer produces events far faster than it crosses between any of
 * them. Publishing a fresh object per move re-rendered the cell under the
 * pointer at pointer-event rate, and a cell's render rebuilds its `ViewStack`;
 * `renderTabContent` hands back a new `views` array each time, so nothing
 * downstream memoises it away. That is the same cost the memoised `handlers`
 * removed for every OTHER cell, still being paid by the one being dragged over.
 */
function samePlace(a: DragState | undefined, b: DragState | undefined) {
  return (
    a?.tabId === b?.tabId &&
    a?.panelId === b?.panelId &&
    a?.zone === b?.zone &&
    a?.strip?.index === b?.strip?.index &&
    a?.strip?.left === b?.strip?.left
  )
}

/**
 * A drop `dropTabInPanel` would decline, so there is nothing to draw for it —
 * the centre wash promises "be a tab of this cell" to a tab already in it, held
 * for the whole hover and then dropped on release.
 *
 * Declining here rather than at the release makes it one decision: nothing is
 * published, so `onTabPointerUp` finds an empty `dragRef` and needs no case.
 * `pendingRef` stays armed, so the drag resumes on crossing back out.
 */
function declines(layout: WorkspaceLayout, drag: DragState) {
  return (
    !drag.strip &&
    drag.zone === 'center' &&
    layout.findTab(drag.tabId)?.panel.id === drag.panelId
  )
}

/**
 * Dragging a tab: pointer events, not HTML5 drag-and-drop.
 *
 * HTML5 DnD would hand us a drag image we don't want, a `dragover` we can't
 * read coordinates from reliably across browsers, and no pointer capture — so
 * releasing outside the window leaves the drag stuck on. Pointer events give
 * capture for free, which is what makes "let go anywhere" behave.
 *
 * The in-flight drag is React state, deliberately NOT in MST. It is transient
 * UI, and putting it in the session would put every intermediate hover into the
 * undo history — which is the mistake `dockviewLayout` made in the other
 * direction, persisting something that was really a view of live state.
 */
export function useLayoutDrag(layout: WorkspaceLayout) {
  const [drag, setDrag] = useState<DragState | undefined>(undefined)
  // the pointer has gone down on a tab but may still turn out to be a click.
  // `pointerId` is what makes every handler below about ONE pointer: a second
  // finger elsewhere in the strip otherwise steers the first one's drag, and
  // its release ends it. dockview tracks the same id for the same reason.
  const pendingRef = useRef<
    { tabId: string; pointerId: number; x: number; y: number } | undefined
  >(undefined)

  /**
   * The drag, mirrored into a ref so the handlers can read it without depending
   * on it — which keeps them identity-stable. They go into `PanelChrome`, so
   * handlers that changed on every pointer move re-rendered every cell in the
   * workspace, and a cell's render rebuilds its `ViewStack`.
   */
  const dragRef = useRef<DragState | undefined>(undefined)
  const showDrag = useCallback((next: DragState | undefined) => {
    if (samePlace(dragRef.current, next)) {
      return
    }
    dragRef.current = next
    setDrag(next)
  }, [])

  const resolveTarget = useCallback((x: number, y: number) => {
    const under = document
      .elementsFromPoint(x, y)
      .filter(el => el instanceof HTMLElement)
    const panelEl = under.find(el => el.dataset.panelId)
    if (!panelEl?.dataset.panelId) {
      return undefined
    }
    const panelId = panelEl.dataset.panelId
    const panelRect = panelEl.getBoundingClientRect()

    // The strip is a finer answer than `center`, and it has to be tested first:
    // the strip sits inside the panel's top edge band, so `dropZoneAt` alone
    // reads a drop between two tabs as "split this cell upwards".
    const stripEl = under.find(el => 'tabStrip' in el.dataset)
    if (stripEl) {
      // panel-relative, so the caret can be drawn inside the panel's own box
      const rects = [...stripEl.querySelectorAll('[data-tab-id]')].map(el => {
        const r = el.getBoundingClientRect()
        return {
          left: r.left - panelRect.left,
          top: r.top - panelRect.top,
          width: r.width,
          height: r.height,
        }
      })
      return {
        panelId,
        zone: 'center' as const,
        strip: stripDropAt(rects, x - panelRect.left),
      }
    }
    return { panelId, zone: dropZoneAt(panelRect, x, y) }
  }, [])

  /**
   * A drag starts on the PRIMARY button of the primary pointer, and on nothing
   * else.
   *
   * dockview never had to say this: its tab drags over HTML5 dnd, where the
   * browser owns the rule, and its pointer source is touch/pen only by default.
   * Pointer events here are for capture (release outside the window ends the
   * drag), which means owning the rule too — and without it a right-drag moved
   * a tab, and a right-press left `pending` armed with no `pointerup` to clear
   * it, because the native context menu eats that one. The next move of a
   * button-less pointer then dragged the tab, and the click that dismissed the
   * menu dropped it.
   */
  const onTabPointerDown = useCallback(
    (tabId: string, event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || !event.isPrimary) {
        return
      }
      // a fresh press is a fresh gesture: anything left over from a drag that
      // ended without a drop would otherwise skip the slop below and start on
      // the first pixel
      showDrag(undefined)
      pendingRef.current = {
        tabId,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [showDrag],
  )

  const onTabPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const pending = pendingRef.current
      if (pending?.pointerId !== event.pointerId) {
        return
      }
      // a few pixels of slop, so a tab click is a click and not a zero-distance
      // drag that lands the tab back where it started
      const moved =
        Math.abs(event.clientX - pending.x) +
        Math.abs(event.clientY - pending.y)
      if (!dragRef.current && moved < 5) {
        return
      }
      const target = resolveTarget(event.clientX, event.clientY)
      const next = target ? { tabId: pending.tabId, ...target } : undefined
      showDrag(next && !declines(layout, next) ? next : undefined)
    },
    [layout, resolveTarget, showDrag],
  )

  /**
   * The gesture ended without a drop: the browser took the pointer away.
   *
   * A long-press on a touch device does exactly this — the platform opens its
   * own context menu and cancels the pointer — and there is no `pointerup` to
   * follow, so the indicator stayed painted over the cell and the drag resumed
   * from the next move. The same clearing as Escape, and for the same reason:
   * clearing only what is on screen leaves `pending` to rebuild it.
   *
   * Capture is already gone by the time this fires, so there is nothing to
   * release.
   */
  const onTabPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const pending = pendingRef.current
      if (pending && pending.pointerId !== event.pointerId) {
        return
      }
      pendingRef.current = undefined
      showDrag(undefined)
    },
    [showDrag],
  )

  const onTabPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const pending = pendingRef.current
      // No pending at all still releases: Escape cancels the drag and leaves
      // capture held, so this is the only thing that gives it back.
      if (pending && pending.pointerId !== event.pointerId) {
        return
      }
      pendingRef.current = undefined
      event.currentTarget.releasePointerCapture(event.pointerId)
      const current = dragRef.current
      showDrag(undefined)
      if (!pending || !current) {
        return
      }
      // a drop on the strip says where in the order; anywhere else appends
      if (current.strip) {
        layout.dropTabInPanel(
          current.tabId,
          current.panelId,
          current.strip.index,
        )
        return
      }
      const split = splitForZone(current.zone)
      if (split) {
        layout.dropTabInNewSplit(
          current.tabId,
          current.panelId,
          split.direction,
          split.before,
        )
      } else {
        layout.dropTabInPanel(current.tabId, current.panelId)
      }
    },
    [layout, showDrag],
  )

  /**
   * Escape abandons an in-flight drag.
   *
   * On `window`, because pointer capture routes POINTER events to the tab and
   * does nothing for the keyboard — focus is wherever it was when the drag
   * started, which is usually not the tab.
   *
   * Clearing `pendingRef` as well as the drag state is the part that matters:
   * the drag is rebuilt from `pending` on every move, so cancelling the visible
   * state alone would let the next pixel of movement resume it.
   *
   * `drag` is the dependency here on purpose, where the handlers avoid it: the
   * listener should exist only while a drag does.
   */
  useEffect(() => {
    if (!drag) {
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        pendingRef.current = undefined
        showDrag(undefined)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [drag, showDrag])

  // one object, memoised: it goes into `PanelChrome`, which every panel holds,
  // so a fresh one per render is a re-render of every cell in the workspace
  const handlers = useMemo(
    () => ({
      onTabPointerDown,
      onTabPointerMove,
      onTabPointerUp,
      onTabPointerCancel,
    }),
    [onTabPointerDown, onTabPointerMove, onTabPointerUp, onTabPointerCancel],
  )

  return { drag, handlers }
}
