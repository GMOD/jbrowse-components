import type React from 'react'
import { lazy, useEffect, useMemo, useRef, useState } from 'react'

import { ErrorMessage, LoadingOverlay } from '@jbrowse/core/ui'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
  useGpuRenderer,
  useTabVisibilityRerender,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'

import { SyntenyRendererFactory } from '../SyntenyRenderer.ts'
import SyntenyContextMenu from './SyntenyContextMenu.tsx'

import type { ClickCoord } from './util.ts'
import type { SyntenyBackend } from '../syntenyBackendTypes.ts'
import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'
import type { LinearSyntenyDisplayModel } from '../model.ts'

const SyntenyTooltip = lazy(() => import('./SyntenyTooltip.tsx'))

const useStyles = makeStyles()({
  rel: {
    position: 'relative',
  },
  gpuCanvas: {
    position: 'absolute',
    imageRendering: 'auto',
    willChange: 'transform',
    contain: 'strict',
  },
})

const LinearSyntenyRendering = observer(function LinearSyntenyRendering({
  model,
}: {
  model: LinearSyntenyDisplayModel
}) {
  const { classes } = useStyles()
  const { tooltipText, height } = model
  const view = getContainingView(model) as LinearSyntenyViewModel
  const width = view.width

  const gpuCanvasRef = useRef<HTMLCanvasElement>(null)
  const xOffset = useRef(0)
  const scheduled = useRef(false)
  const zoomDelta = useRef(0)
  const zoomScheduled = useRef(false)
  const lastZoomClientX = useRef(0)
  const mouseCurrDownX = useRef<number | undefined>(undefined)
  const mouseInitialDownX = useRef<number | undefined>(undefined)

  const [anchorEl, setAnchorEl] = useState<ClickCoord>()

  const gpuOpts = useMemo(
    () => ({
      onReady: (renderer: SyntenyBackend) => {
        model.setGpuRenderer(renderer)
      },
      onDispose: () => {
        model.setGpuRenderer(null)
      },
    }),
    [model],
  )
  const { error, retry } = useGpuRenderer(gpuCanvasRef, SyntenyRendererFactory, gpuOpts)

  // SYNC across model-driven GPU displays (dotplot, linear synteny,
  // multi-LGV synteny): bumps tabVisibilityVersion so the model draw autorun
  // re-fires on tab restore. Hook-driven displays pass renderNow directly to
  // useTabVisibilityRerender instead.
  useTabVisibilityRerender(() => {
    model.bumpTabVisibility()
  })

  function getEventCanvasCoords(evt: { clientX: number; clientY: number }) {
    const rect = gpuCanvasRef.current?.getBoundingClientRect()
    if (!rect) {
      return undefined
    }
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top }
  }

  function scheduleHorizontalScroll() {
    if (scheduled.current) {
      return
    }
    scheduled.current = true
    window.requestAnimationFrame(() => {
      transaction(() => {
        for (const v of view.views) {
          v.horizontalScroll(xOffset.current)
        }
        xOffset.current = 0
        scheduled.current = false
      })
    })
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  useEffect(() => {
    let scrollingTimer: ReturnType<typeof setTimeout> | undefined
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      model.setIsScrolling(true)
      clearTimeout(scrollingTimer)
      scrollingTimer = setTimeout(() => {
        model.setIsScrolling(false)
      }, 150)

      const doZoom =
        event.ctrlKey ||
        (view.scrollZoom && Math.abs(event.deltaY) > Math.abs(event.deltaX))
      if (doZoom) {
        zoomDelta.current += event.deltaY / 500
        lastZoomClientX.current = event.clientX
        if (!zoomScheduled.current) {
          zoomScheduled.current = true
          window.requestAnimationFrame(() => {
            const d = zoomDelta.current
            const canvasLeft =
              gpuCanvasRef.current?.getBoundingClientRect().left ?? 0
            transaction(() => {
              for (const v of view.views) {
                v.zoomTo(
                  d > 0 ? v.bpPerPx * (1 + d) : v.bpPerPx / (1 - d),
                  lastZoomClientX.current - canvasLeft,
                )
              }
            })
            zoomDelta.current = 0
            zoomScheduled.current = false
          })
        }
      } else {
        if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
          xOffset.current += event.deltaX / 2
        }
        scheduleHorizontalScroll()
      }
    }
    const target = gpuCanvasRef.current
    target?.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      target?.removeEventListener('wheel', onWheel)
      clearTimeout(scrollingTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model])

  function handleMouseMove(event: React.MouseEvent<HTMLCanvasElement>) {
    if (mouseCurrDownX.current !== undefined) {
      xOffset.current += mouseCurrDownX.current - event.clientX
      mouseCurrDownX.current = event.clientX
      scheduleHorizontalScroll()
      return
    }

    const coords = getEventCanvasCoords(event)
    if (!coords) {
      return
    }

    if (model.isScrolling) {
      model.setHoveredFeatureIdx(-1)
    } else {
      model.gpuRenderer?.pick(coords.x, coords.y, featureIndex => {
        model.setHoveredFeatureIdx(featureIndex)
      })
    }
  }

  function handleMouseLeave() {
    model.setHoveredFeatureIdx(-1)
    mouseInitialDownX.current = undefined
    mouseCurrDownX.current = undefined
    model.setIsScrolling(false)
  }

  function handleMouseDown(evt: React.MouseEvent) {
    mouseCurrDownX.current = evt.clientX
    mouseInitialDownX.current = evt.clientX
    model.setIsScrolling(true)
  }

  function handleMouseUp(evt: React.MouseEvent<HTMLCanvasElement>) {
    mouseCurrDownX.current = undefined
    model.setIsScrolling(false)
    if (
      mouseInitialDownX.current !== undefined &&
      Math.abs(evt.clientX - mouseInitialDownX.current) < 5
    ) {
      const coords = getEventCanvasCoords(evt)
      if (!coords || !model.gpuRenderer) {
        return
      }
      const featureIndex = model.gpuRenderer.pick(coords.x, coords.y)
      if (
        featureIndex !== undefined &&
        featureIndex >= 0 &&
        featureIndex < model.numFeats
      ) {
        model.setClickedFeatureIdx(featureIndex)
        const feat = model.getFeature(featureIndex)
        if (feat) {
          const session = getSession(model)
          if (isSessionModelWithWidgets(session)) {
            session.showWidget(
              session.addWidget('SyntenyFeatureWidget', 'syntenyFeature', {
                view: getContainingView(model),
                track: getContainingTrack(model),
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
                level: model.level,
              }),
            )
          }
        }
      } else {
        model.setClickedFeatureIdx(-1)
      }
    }
  }

  function handleContextMenu(evt: React.MouseEvent<HTMLCanvasElement>) {
    if (!model.gpuRenderer) {
      return
    }
    evt.preventDefault()
    const coords = getEventCanvasCoords(evt)
    if (!coords) {
      return
    }
    const featureIndex = model.gpuRenderer.pick(coords.x, coords.y)
    if (
      featureIndex !== undefined &&
      featureIndex >= 0 &&
      featureIndex < model.numFeats
    ) {
      const feat = model.getFeature(featureIndex)
      if (feat) {
        setAnchorEl({
          clientX: evt.clientX,
          clientY: evt.clientY,
          feature: feat,
        })
      }
    }
  }

  return (
    <div className={classes.rel}>
      <canvas
        ref={gpuCanvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        data-testid={
          model.canvasDrawn ? 'synteny_canvas_done' : 'synteny_canvas'
        }
        className={classes.gpuCanvas}
        style={{ width, height }}
      />
      {error ? <ErrorMessage error={error} onReset={retry} /> : null}
      <LoadingOverlay
        statusMessage={model.statusMessage}
        isVisible={!model.ready}
      />
      {tooltipText ? <SyntenyTooltip title={tooltipText} /> : null}
      {anchorEl ? (
        <SyntenyContextMenu
          model={model}
          anchorEl={anchorEl}
          onClose={() => {
            setAnchorEl(undefined)
          }}
        />
      ) : null}
    </div>
  )
})

export default LinearSyntenyRendering
