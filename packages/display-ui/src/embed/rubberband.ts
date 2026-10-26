import { useRef, useState } from 'react'

import { usePointerDrag } from '@jbrowse/core/util/usePointerDrag'

export interface RubberbandView<Offset> {
  width: number
  pxToBp: (px: number) => Offset
  moveTo: (start: Offset, end: Offset) => void
}

const MIN_DRAG_PX = 4

/**
 * Drag across an element to select an interval of the view, as JBrowse's own
 * scalebar does. `range` is the selection in px from the view's left edge
 * while the drag runs; on release a selection wider than a few pixels goes to
 * `onSelect`, which zooms to it by default. Spread `props` onto the element,
 * and give it `touch-action: none`.
 */
export function useRubberband<Offset>(
  view: RubberbandView<Offset>,
  onSelect: (start: Offset, end: Offset) => void = (start, end) => {
    view.moveTo(start, end)
  },
) {
  const [range, setRange] = useState<{ left: number; right: number }>()
  const anchor = useRef({ x: 0, origin: 0 })
  const span = (clientX: number) => {
    const { x, origin } = anchor.current
    const at = Math.min(Math.max(clientX - origin, 0), view.width)
    return { left: Math.min(x, at), right: Math.max(x, at) }
  }
  const props = usePointerDrag({
    onDragStart(event) {
      const origin = event.currentTarget.getBoundingClientRect().left
      anchor.current = { x: event.clientX - origin, origin }
    },
    onDrag(event) {
      setRange(span(event.clientX))
    },
    onDragEnd(event) {
      const { left, right } = span(event.clientX)
      setRange(undefined)
      if (right - left >= MIN_DRAG_PX) {
        onSelect(view.pxToBp(left), view.pxToBp(right))
      }
    },
  })
  return { range, props }
}
