import { useEffect } from 'react'

import { normalizeWheelDelta } from '@jbrowse/core/util/wheelZoom'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type React from 'react'

export interface LaneSlideModel extends IStateTreeNode {
  laneDragPx: ReadonlyMap<string, number>
  slidableLaneAt: (y: number) => string | undefined
  setLaneDragPx: (assemblyName: string, dxPx: number) => void
  endLaneDrag: (assemblyName: string) => void
}

// one undo step per side-scroll burst, not one per event
const WHEEL_SETTLE_MS = 250

/** Claims the press before the view's own pan sees it. */
export function useLaneSlide(
  model: LaneSlideModel,
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
      event.isPrimary &&
      event.button === 0 &&
      !event.shiftKey &&
      target.tagName === 'CANVAS'
        ? model.slidableLaneAt(
            event.clientY - event.currentTarget.getBoundingClientRect().top,
          )
        : undefined
    if (lane === undefined) {
      return
    }
    event.stopPropagation()
    const { pointerId } = event
    const startX = event.clientX
    let frame: number | undefined
    let x = startX
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) {
        return
      }
      x = e.clientX
      frame ??= requestAnimationFrame(() => {
        frame = undefined
        if (isAlive(model)) {
          model.setLaneDragPx(lane, x - startX)
        }
      })
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) {
        return
      }
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
