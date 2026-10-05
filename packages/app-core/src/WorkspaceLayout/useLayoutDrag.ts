import { useCallback, useRef, useState } from 'react'

import { dropZoneAt, splitForZone, stripDropAt } from './dropZone.ts'
import { usePointerGesture } from './usePointerGesture.ts'

import type { DropTarget } from './dropZone.ts'
import type { WorkspaceLayout } from './model.ts'

export interface DragState extends DropTarget {
  tabId: string
  panelId: string
}

// the indicator is a function of the cell and the zone or strip gap, so a move
// that paints the same one publishes nothing
function samePlace(a: DragState | undefined, b: DragState | undefined) {
  return (
    a?.tabId === b?.tabId &&
    a?.panelId === b?.panelId &&
    a?.zone === b?.zone &&
    a?.strip?.index === b?.strip?.index &&
    a?.strip?.left === b?.strip?.left
  )
}

// a centre drop on the tab's own cell, which `dropTabInPanel` declines, so it
// paints nothing either
function declines(layout: WorkspaceLayout, drag: DragState) {
  return (
    !drag.strip &&
    drag.zone === 'center' &&
    layout.findTab(drag.tabId)?.panel.id === drag.panelId
  )
}

/**
 * Dragging a tab. Pointer events rather than HTML5 dnd, for capture; the
 * in-flight drag is React state rather than MST, so hovers stay out of undo.
 */
export function useLayoutDrag(layout: WorkspaceLayout) {
  const [drag, setDrag] = useState<DragState | undefined>(undefined)
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

  const handlers = usePointerGesture<{ tabId: string; x: number; y: number }>({
    escapeCancels: true,
    start(event) {
      const { tabId } = event.currentTarget.dataset
      return tabId === undefined
        ? undefined
        : { tabId, x: event.clientX, y: event.clientY }
    },
    move(pending, event) {
      // a few pixels of slop, so a tab click is a click and not a
      // zero-distance drag that lands the tab back where it started
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
    end(_pending, completed) {
      const current = dragRef.current
      showDrag(undefined)
      if (!completed || !current) {
        return
      }
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
  })

  return { drag, handlers }
}
