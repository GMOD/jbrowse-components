import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { dropZoneAt, splitForZone, stripDropAt } from './dropZone.ts'

import type { DropTarget, DropZone } from './dropZone.ts'
import type { WorkspaceLayout } from './model.ts'

export interface DragState extends DropTarget {
  tabId: string
  panelId: string
  zone: DropZone
}

export interface TabDragHandlers {
  onTabPointerDown: (
    tabId: string,
    event: React.PointerEvent<HTMLElement>,
  ) => void
  onTabPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  onTabPointerUp: (event: React.PointerEvent<HTMLElement>) => void
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
  // the pointer has gone down on a tab but may still turn out to be a click
  const pendingRef = useRef<
    { tabId: string; x: number; y: number } | undefined
  >(undefined)

  /**
   * The drag, mirrored into a ref, so the handlers can read it without
   * depending on it.
   *
   * This is what keeps the handlers identity-stable across a drag, and that is
   * not a micro-optimisation: they are part of `PanelChrome`, which every panel
   * holds, so handlers that changed on every pointer move re-rendered every
   * cell — and a cell's render rebuilds its `ViewStack`. Dragging one tab
   * across the window re-rendered every view in the workspace, at pointer-event
   * rate, for a caret moving a few pixels.
   */
  const dragRef = useRef<DragState | undefined>(undefined)
  const showDrag = useCallback((next: DragState | undefined) => {
    dragRef.current = next
    setDrag(next)
  }, [])

  const resolveTarget = useCallback((x: number, y: number) => {
    const under = document.elementsFromPoint(x, y)
    const panelEl = under.find(
      el => el instanceof HTMLElement && el.dataset.panelId,
    ) as HTMLElement | undefined
    if (!panelEl?.dataset.panelId) {
      return undefined
    }
    const panelId = panelEl.dataset.panelId
    const panelRect = panelEl.getBoundingClientRect()

    // The strip is a finer answer than `center`, and it has to be tested first:
    // the strip sits inside the panel's top edge band, so `dropZoneAt` alone
    // reads a drop between two tabs as "split this cell upwards".
    const stripEl = under.find(
      el => el instanceof HTMLElement && 'tabStrip' in el.dataset,
    ) as HTMLElement | undefined
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

  const onTabPointerDown = useCallback(
    (tabId: string, event: React.PointerEvent<HTMLElement>) => {
      pendingRef.current = { tabId, x: event.clientX, y: event.clientY }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [],
  )

  const onTabPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const pending = pendingRef.current
      if (!pending) {
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
      showDrag(target ? { tabId: pending.tabId, ...target } : undefined)
    },
    [resolveTarget, showDrag],
  )

  const onTabPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const pending = pendingRef.current
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
   * Bound only while a drag is up — `drag` is the dependency here on purpose,
   * where the handlers avoid it: a keydown listener on `window` for the whole
   * life of the workspace is a listener in every session that never drags a
   * tab.
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
    () => ({ onTabPointerDown, onTabPointerMove, onTabPointerUp }),
    [onTabPointerDown, onTabPointerMove, onTabPointerUp],
  )

  return { drag, handlers }
}
