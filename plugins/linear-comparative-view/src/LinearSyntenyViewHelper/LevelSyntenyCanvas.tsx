import type React from 'react'
import { useEffect, useRef } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
  useGpuModelLifecycle,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { transaction } from 'mobx'
import { isAlive } from 'mobx-state-tree'
import { observer } from 'mobx-react'

import { SyntenyRendererFactory } from '../LinearSyntenyDisplay/SyntenyRenderer.ts'

import type { LinearSyntenyViewHelperModel } from './stateModelFactory.ts'
import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  root: {
    position: 'absolute',
    inset: 0,
  },
  canvas: {
    position: 'absolute',
    inset: 0,
    imageRendering: 'auto',
    willChange: 'transform',
    contain: 'strict',
  },
})

interface ParentViewDuck {
  width: number
  views: LinearGenomeViewModel[]
  scrollZoom: boolean
}

function openFeatureWidget(
  display: LinearSyntenyDisplayModel,
  featureIndex: number,
) {
  const feat = display.getFeature(featureIndex)
  if (!feat) {
    return
  }
  const session = getSession(display)
  if (!isSessionModelWithWidgets(session)) {
    return
  }
  session.showWidget(
    session.addWidget('SyntenyFeatureWidget', 'syntenyFeature', {
      view: getContainingView(display),
      track: getContainingTrack(display),
      featureData: {
        uniqueId: feat.id,
        start: feat.start,
        end: feat.end,
        strand: feat.strand,
        refName: feat.refName,
        name: feat.name,
        assemblyName: feat.assemblyName,
        mate: feat.mate,
        identity: feat.identity,
      },
      level: display.level,
    }),
  )
}

const LevelSyntenyCanvas = observer(function LevelSyntenyCanvas({
  model,
}: {
  model: LinearSyntenyViewHelperModel
}) {
  const { classes } = useStyles()
  const parentView = getContainingView(model) as unknown as ParentViewDuck
  const width = parentView.width
  const height = model.effectiveHeight

  const dragStartX = useRef<number | undefined>(undefined)
  const lastDragX = useRef<number | undefined>(undefined)
  const scrollAccumX = useRef(0)
  const scrollScheduled = useRef(false)
  const zoomAccum = useRef(0)
  const zoomScheduled = useRef(false)
  const lastZoomClientX = useRef(0)

  const { canvas, canvasRef, error, retry } = useGpuModelLifecycle(
    SyntenyRendererFactory,
    model,
  )

  function canvasCoords(evt: { clientX: number; clientY: number }) {
    const rect = canvas?.getBoundingClientRect()
    if (!rect) {
      return undefined
    }
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top }
  }

  function flushHorizontalScroll() {
    if (scrollScheduled.current) {
      return
    }
    scrollScheduled.current = true
    requestAnimationFrame(() => {
      transaction(() => {
        for (const v of parentView.views) {
          v.horizontalScroll(scrollAccumX.current)
        }
        scrollAccumX.current = 0
        scrollScheduled.current = false
      })
    })
  }

  const scrollingRef = useRef(false)

  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout> | undefined
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      scrollingRef.current = true
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => {
        scrollingRef.current = false
      }, 150)

      const doZoom =
        event.ctrlKey ||
        (parentView.scrollZoom &&
          Math.abs(event.deltaY) > Math.abs(event.deltaX))
      if (doZoom) {
        zoomAccum.current += event.deltaY / 500
        lastZoomClientX.current = event.clientX
        if (!zoomScheduled.current) {
          zoomScheduled.current = true
          requestAnimationFrame(() => {
            const d = zoomAccum.current
            const canvasLeft = canvas?.getBoundingClientRect().left ?? 0
            transaction(() => {
              for (const v of parentView.views) {
                v.zoomTo(
                  d > 0 ? v.bpPerPx * (1 + d) : v.bpPerPx / (1 - d),
                  lastZoomClientX.current - canvasLeft,
                )
              }
            })
            zoomAccum.current = 0
            zoomScheduled.current = false
          })
        }
      } else if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
        scrollAccumX.current += event.deltaX / 2
        flushHorizontalScroll()
      }
    }
    canvas?.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas?.removeEventListener('wheel', onWheel)
      clearTimeout(scrollTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, model, parentView])

  function dispatchHoverPick(coords: { x: number; y: number }) {
    const backend = model.gpuBackend
    if (!backend) {
      return
    }
    backend.pick(coords.x, coords.y, hit => {
      const hitDisplay = hit ? model.displaysByKey.get(hit.key) : undefined
      for (const display of model.linearSyntenyDisplays) {
        if (isAlive(display)) {
          display.setHoveredFeatureIdx(
            display === hitDisplay ? hit!.featureIndex : -1,
          )
        }
      }
    })
  }

  function handleMouseMove(event: React.MouseEvent<HTMLCanvasElement>) {
    if (lastDragX.current !== undefined) {
      scrollAccumX.current += lastDragX.current - event.clientX
      lastDragX.current = event.clientX
      flushHorizontalScroll()
      return
    }
    if (scrollingRef.current) {
      return
    }
    const coords = canvasCoords(event)
    if (coords) {
      dispatchHoverPick(coords)
    }
  }

  function handleMouseLeave() {
    for (const display of model.linearSyntenyDisplays) {
      display.setHoveredFeatureIdx(-1)
    }
    dragStartX.current = undefined
    lastDragX.current = undefined
    // Advance the GPU pick generation so any in-flight async readback result
    // is discarded rather than re-setting hover state after the mouse left.
    dispatchHoverPick({ x: -99999, y: -99999 })
  }

  function handleMouseDown(event: React.MouseEvent) {
    dragStartX.current = event.clientX
    lastDragX.current = event.clientX
  }

  function handleMouseUp(event: React.MouseEvent<HTMLCanvasElement>) {
    const start = dragStartX.current
    lastDragX.current = undefined
    dragStartX.current = undefined
    if (start === undefined || Math.abs(event.clientX - start) >= 5) {
      return
    }
    const coords = canvasCoords(event)
    if (!coords) {
      return
    }
    const backend = model.gpuBackend
    if (!backend) {
      return
    }
    const hit = backend.pick(coords.x, coords.y)
    for (const display of model.linearSyntenyDisplays) {
      const isHit = hit && model.displaysByKey.get(hit.key) === display
      display.setClickedFeatureIdx(isHit ? hit.featureIndex : -1)
      if (isHit) {
        openFeatureWidget(display, hit.featureIndex)
      }
    }
  }

  function handleContextMenu(event: React.MouseEvent<HTMLCanvasElement>) {
    const backend = model.gpuBackend
    if (!backend) {
      return
    }
    event.preventDefault()
    const coords = canvasCoords(event)
    if (!coords) {
      return
    }
    const hit = backend.pick(coords.x, coords.y)
    if (!hit) {
      return
    }
    const hitDisplay = model.displaysByKey.get(hit.key)
    const feat = hitDisplay?.getFeature(hit.featureIndex)
    if (hitDisplay && feat) {
      hitDisplay.openContextMenu({
        clientX: event.clientX,
        clientY: event.clientY,
        feature: feat,
      })
    }
  }

  return (
    <div className={classes.root} style={{ width, height }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        data-testid={
          model.canvasDrawn ? 'synteny_canvas_done' : 'synteny_canvas'
        }
        className={classes.canvas}
        style={{ width, height }}
      />
      {error ? <ErrorMessage error={error} onReset={retry} /> : null}
    </div>
  )
})

export default LevelSyntenyCanvas
