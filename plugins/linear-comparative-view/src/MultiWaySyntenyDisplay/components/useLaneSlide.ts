import { useEffect } from 'react'

import { normalizeWheelDelta } from '@jbrowse/core/util/wheelZoom'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { MultiWaySyntenyDisplayModel } from '../model.ts'
import type React from 'react'

// one undo step per side-scroll burst, not one per event
const WHEEL_SETTLE_MS = 250

/** Claims the press before the view's own pan sees it. */
export function useLaneSlide(
  model: MultiWaySyntenyDisplayModel,
  panel: HTMLDivElement | null,
) {
  useEffect(() => {
    if (!panel) {
      return
    }
    let lane: string | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const settle = () => {
      if (lane !== undefined) {
        model.endLaneDrag(lane)
        lane = undefined
      }
    }
    const onWheel = (event: WheelEvent) => {
      const dx = normalizeWheelDelta(event.deltaX, event.deltaMode)
      const dy = normalizeWheelDelta(event.deltaY, event.deltaMode)
      if (event.defaultPrevented || Math.abs(dx) <= Math.abs(dy)) {
        return
      }
      const hit =
        lane ??
        model.slidableLaneAt(event.clientY - panel.getBoundingClientRect().top)
      if (hit !== undefined) {
        event.preventDefault()
        lane = hit
        model.setLaneDragPx(hit, (model.laneDragPx.get(hit) ?? 0) - dx)
        clearTimeout(timer)
        timer = setTimeout(settle, WHEEL_SETTLE_MS)
      }
    }
    panel.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      panel.removeEventListener('wheel', onWheel)
      clearTimeout(timer)
      settle()
    }
  }, [model, panel])

  return (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const lane =
      event.button === 0 && !event.shiftKey && target.tagName === 'CANVAS'
        ? model.slidableLaneAt(
            event.clientY - event.currentTarget.getBoundingClientRect().top,
          )
        : undefined
    if (lane === undefined) {
      return
    }
    event.stopPropagation()
    const startX = event.clientX
    let frame: number | undefined
    let x = startX
    const move = (e: PointerEvent) => {
      x = e.clientX
      frame ??= requestAnimationFrame(() => {
        frame = undefined
        if (isAlive(model)) {
          model.setLaneDragPx(lane, x - startX)
        }
      })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (frame !== undefined) {
        cancelAnimationFrame(frame)
      }
      if (isAlive(model)) {
        model.setLaneDragPx(lane, x - startX)
        model.endLaneDrag(lane)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
}
