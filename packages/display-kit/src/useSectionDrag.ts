import { useRef, useState } from 'react'

import { dropLineTop, sectionAt } from './sectionDrag.ts'

import type React from 'react'

const DRAG_THRESHOLD_PX = 4

interface Press {
  pointerId: number
  key: string
  startY: number
  originY: number
  moved: boolean
}

/**
 * Drag a section chip onto another to reorder. The pill takes pointer capture
 * only once the press becomes a drag: a browser sends the click of a captured
 * press to the capturing pill, so capturing on pointerdown would starve the
 * hide and collapse buttons inside it. A drag swallows the click it would
 * deliver to the chip button it started on.
 */
export function useSectionDrag(
  sections: readonly { key: string; top: number; height: number }[],
  onMove: ((key: string, ontoKey: string) => void) | undefined,
) {
  const [drag, setDrag] = useState<{ key: string; ontoKey: string }>()
  const pressRef = useRef<Press | undefined>(undefined)
  const swallowClickRef = useRef(false)

  function pressOf(event: React.PointerEvent) {
    const press = pressRef.current
    return press?.pointerId === event.pointerId ? press : undefined
  }

  function startDrag(event: React.PointerEvent, press: Press) {
    press.moved = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function end(event: React.PointerEvent) {
    const press = pressOf(event)
    if (press) {
      pressRef.current = undefined
      setDrag(undefined)
      if (press.moved) {
        swallowClickRef.current = true
        if (event.type === 'pointerup' && drag && drag.key !== drag.ontoKey) {
          onMove?.(drag.key, drag.ontoKey)
        }
      }
    }
  }

  return {
    enabled: !!onMove,
    draggingKey: drag?.key,
    dropLineTop: drag && dropLineTop(sections, drag.key, drag.ontoKey),
    handlers: (key: string) =>
      onMove
        ? {
            'data-section-key': key,
            'data-gesture-owner': 'true',
            onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
              if (event.button === 0 && !pressRef.current?.moved) {
                swallowClickRef.current = false
                pressRef.current = {
                  pointerId: event.pointerId,
                  key,
                  startY: event.clientY,
                  originY:
                    event.currentTarget.parentElement?.offsetParent?.getBoundingClientRect()
                      .top ?? 0,
                  moved: false,
                }
              }
            },
            onPointerMove: (event: React.PointerEvent) => {
              const press = pressOf(event)
              if (
                press &&
                (press.moved ||
                  Math.abs(event.clientY - press.startY) >= DRAG_THRESHOLD_PX)
              ) {
                if (!press.moved) {
                  startDrag(event, press)
                }
                const onto = sectionAt(sections, event.clientY - press.originY)
                if (onto) {
                  setDrag({ key: press.key, ontoKey: onto.key })
                }
              }
            },
            onPointerLeave: (event: React.PointerEvent) => {
              const press = pressOf(event)
              if (press && !press.moved) {
                startDrag(event, press)
              }
            },
            onPointerUp: end,
            onPointerCancel: end,
            onClickCapture: (event: React.MouseEvent) => {
              if (swallowClickRef.current) {
                swallowClickRef.current = false
                event.stopPropagation()
                event.preventDefault()
              }
            },
          }
        : {},
  }
}
