import { useEffect } from 'react'

import { morphClockMs } from '@jbrowse/core/util'
import { isLiveModel } from '@jbrowse/display-ui'
import { autorun } from 'mobx'

/**
 * A transition still drawing frames toward the settled picture, which the
 * chrome publishes as `data-display-animating` rather than as a phase, so no
 * scrim goes up over a motion the reader is meant to watch
 */
export interface AnimationHost {
  animating?: boolean
  advanceAnimation?: (nowMs: number) => void
  endAnimation?: () => void
}

/**
 * The frame clock for a display's transition: `advanceAnimation` once per
 * animation frame while `animating` reads true, and `endAnimation` on unmount,
 * since nothing else advances the clock and a transition left in flight holds
 * its half-drawn picture until the model's own deadline.
 */
export function useAnimationFrames(model: AnimationHost) {
  useEffect(() => {
    if (!model.advanceAnimation) {
      return
    }
    let raf = 0
    const schedule = () => {
      if (model.animating && raf === 0) {
        raf = requestAnimationFrame(frame)
      }
    }
    const frame = () => {
      raf = 0
      if (isLiveModel(model) && model.animating) {
        model.advanceAnimation?.(morphClockMs())
        schedule()
      }
    }
    const dispose = autorun(schedule)
    return () => {
      dispose()
      cancelAnimationFrame(raf)
      if (isLiveModel(model)) {
        model.endAnimation?.()
      }
    }
  }, [model])
}
