import { useLayoutEffect, useRef } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { scrollPortOf } from '@jbrowse/core/util/hooks'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import { RESIZE_ALL_HANDLE_HEIGHT } from '../consts.ts'

import type { LinearGenomeViewModel } from '../index.ts'

function useScrollPortExcess(
  ref: React.RefObject<HTMLDivElement | null>,
  model: LinearGenomeViewModel,
  enabled: boolean,
) {
  useLayoutEffect(() => {
    const box =
      ref.current?.closest<HTMLElement>('[data-testid^="view-container-"]') ??
      ref.current?.closest<HTMLElement>('[data-testid^="linear-genome-view-"]')
    if (!enabled || !box || !('ResizeObserver' in window)) {
      return
    }
    const port = scrollPortOf(box)
    const measure = () => {
      const { marginTop, marginBottom } = getComputedStyle(box)
      const outer =
        box.getBoundingClientRect().height +
        Number.parseFloat(marginTop) +
        Number.parseFloat(marginBottom)
      model.setScrollPortExcess(
        Math.round(outer - (port?.clientHeight ?? window.innerHeight)),
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    if (port) {
      observer.observe(port)
    } else {
      window.addEventListener('resize', measure)
    }
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      if (isAlive(model)) {
        model.setScrollPortExcess(undefined)
      }
    }
  }, [ref, model, enabled])
}

const ResizeAllTracksHandle = observer(function ResizeAllTracksHandle({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef({ from: new Map<string, number>(), moved: 0 })
  const { isTopLevelView } = model
  useScrollPortExcess(ref, model, isTopLevelView)

  return (
    <div ref={ref}>
      <ResizeHandle
        bar
        data-testid="resize-all-tracks"
        title={
          isTopLevelView
            ? 'Drag to resize all tracks, double-click to fit them to the window'
            : 'Drag to resize all tracks'
        }
        style={{ height: RESIZE_ALL_HANDLE_HEIGHT }}
        onDragStart={() => {
          drag.current = { from: model.resizableTrackHeights, moved: 0 }
          for (const track of model.tracks) {
            track.setResizing(true)
          }
        }}
        onDrag={distance => {
          drag.current.moved = model.resizeTracks(
            drag.current.moved + distance,
            drag.current.from,
          )
        }}
        onDragEnd={() => {
          for (const track of model.tracks) {
            track.setResizing(false)
          }
        }}
        onDoubleClick={() => {
          model.fitTracksToWindow()
        }}
      />
    </div>
  )
})

export default ResizeAllTracksHandle
