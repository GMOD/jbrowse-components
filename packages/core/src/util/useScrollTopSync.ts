import { useEffect } from 'react'
import type React from 'react'

import { autorun } from 'mobx'

interface ScrollTopModel {
  scrollTop: number
  setScrollTop: (top: number) => void
}

// Two-way binding between model.scrollTop (MST) and a DOM overflow container's
// native scrollTop, for displays that scroll their rows in a native overflow
// port (canvas basic, plain variant). The wheel/gesture handling stays in each
// caller — only this mechanical sync is shared.
//
// 1. model -> DOM via autorun, catching programmatic resets (e.g.
//    clearDisplaySpecificData). The effect cleanup disposes the autorun; MST
//    destruction is always preceded by React unmount in practice.
// 2. DOM -> model via a rAF-coalesced scroll listener, so a burst of native
//    scroll events collapses into one model write per frame.
export function useScrollTopSync(
  containerRef: React.RefObject<HTMLElement | null>,
  model: ScrollTopModel,
) {
  useEffect(() => {
    const el = containerRef.current
    return el
      ? autorun(() => {
          const target = model.scrollTop
          if (el.scrollTop !== target) {
            el.scrollTop = target
          }
        })
      : undefined
  }, [containerRef, model])

  useEffect(() => {
    const el = containerRef.current
    if (el) {
      let rafId = 0
      const scheduleSync = () => {
        if (rafId === 0) {
          rafId = requestAnimationFrame(() => {
            rafId = 0
            model.setScrollTop(el.scrollTop)
          })
        }
      }
      el.addEventListener('scroll', scheduleSync, { passive: true })
      return () => {
        el.removeEventListener('scroll', scheduleSync)
        if (rafId !== 0) {
          cancelAnimationFrame(rafId)
        }
      }
    }
    return undefined
  }, [containerRef, model])
}
