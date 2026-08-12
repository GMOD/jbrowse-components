import { useCallback, useRef, useState } from 'react'

import { dropZoneAt, splitForZone } from './dropZone.ts'

import type { DropZone } from './dropZone.ts'
import type { WorkspaceLayout } from './model.ts'

export interface DragState {
  viewId: string
  panelId: string
  zone: DropZone
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
    { viewId: string; x: number; y: number } | undefined
  >(undefined)

  const resolveTarget = useCallback((x: number, y: number) => {
    const panelEl = document
      .elementsFromPoint(x, y)
      .find(el => el instanceof HTMLElement && el.dataset.panelId) as
      | HTMLElement
      | undefined
    if (!panelEl?.dataset.panelId) {
      return undefined
    }
    return {
      panelId: panelEl.dataset.panelId,
      zone: dropZoneAt(panelEl.getBoundingClientRect(), x, y),
    }
  }, [])

  const onTabPointerDown = useCallback(
    (viewId: string, event: React.PointerEvent<HTMLElement>) => {
      pendingRef.current = { viewId, x: event.clientX, y: event.clientY }
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
      // drag that lands the view back where it started
      const moved =
        Math.abs(event.clientX - pending.x) +
        Math.abs(event.clientY - pending.y)
      if (!drag && moved < 5) {
        return
      }
      const target = resolveTarget(event.clientX, event.clientY)
      setDrag(target ? { viewId: pending.viewId, ...target } : undefined)
    },
    [drag, resolveTarget],
  )

  const onTabPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const pending = pendingRef.current
      pendingRef.current = undefined
      event.currentTarget.releasePointerCapture(event.pointerId)
      const current = drag
      setDrag(undefined)
      if (!pending || !current) {
        return
      }
      const split = splitForZone(current.zone)
      if (split) {
        layout.dropViewInNewSplit(
          current.viewId,
          current.panelId,
          split.direction,
          split.before,
        )
      } else {
        layout.dropViewInPanel(current.viewId, current.panelId)
      }
    },
    [drag, layout],
  )

  return { drag, onTabPointerDown, onTabPointerMove, onTabPointerUp }
}
