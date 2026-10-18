import { useRef, useState } from 'react'

import { usePointerDrag } from '@jbrowse/core/util/usePointerDrag'

import { dropLineTop, sectionAt } from './sectionDrag.ts'

import type React from 'react'

const DRAG_THRESHOLD_PX = 4

interface Press {
  key: string
  startY: number
  originY: number
  moved: boolean
}

// A drag swallows the click it would deliver to the chip button it started on.
export function useSectionDrag(
  sections: readonly { key: string; top: number; height: number }[],
  onMove: ((key: string, ontoKey: string) => void) | undefined,
) {
  const [drag, setDrag] = useState<{ key: string; ontoKey: string }>()
  const pressRef = useRef<Press | undefined>(undefined)
  const swallowClickRef = useRef(false)
  const pointer = usePointerDrag({
    onDragStart: event => {
      swallowClickRef.current = false
      const pill = event.currentTarget as HTMLElement
      const key = pill.dataset.sectionKey
      pressRef.current =
        key === undefined
          ? undefined
          : {
              key,
              startY: event.clientY,
              originY:
                pill.parentElement?.offsetParent?.getBoundingClientRect().top ??
                0,
              moved: false,
            }
    },
    onDrag: event => {
      const press = pressRef.current
      if (
        !press ||
        (!press.moved &&
          Math.abs(event.clientY - press.startY) < DRAG_THRESHOLD_PX)
      ) {
        return
      }
      press.moved = true
      const onto = sectionAt(sections, event.clientY - press.originY)
      if (onto) {
        setDrag({ key: press.key, ontoKey: onto.key })
      }
    },
    onDragEnd: event => {
      const moved = pressRef.current?.moved
      pressRef.current = undefined
      setDrag(undefined)
      if (moved) {
        swallowClickRef.current = true
        if (event.type === 'pointerup' && drag && drag.key !== drag.ontoKey) {
          onMove?.(drag.key, drag.ontoKey)
        }
      }
    },
  })

  return {
    enabled: !!onMove,
    draggingKey: drag?.key,
    dropLineTop: drag && dropLineTop(sections, drag.key, drag.ontoKey),
    handlers: (key: string) =>
      onMove
        ? {
            ...pointer,
            'data-section-key': key,
            'data-gesture-owner': 'true',
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
