import type React from 'react'
import { lazy, useCallback, useEffect, useRef, useState } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'

import { SyntenyRenderer } from '../SyntenyRenderer.ts'
import SyntenyContextMenu from './SyntenyContextMenu.tsx'
import { getTooltip } from './util.ts'

import type { ClickCoord } from './util.ts'
import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'
import type { LinearSyntenyDisplayModel } from '../model.ts'

const SyntenyTooltip = lazy(() => import('./SyntenyTooltip.tsx'))

const useStyles = makeStyles()(theme => {
  const bg = theme.palette.action.disabledBackground
  return {
    rel: {
      position: 'relative',
    },
    gpuCanvas: {
      position: 'absolute',
      imageRendering: 'auto',
      willChange: 'transform',
      contain: 'strict',
    },
    gpuLoadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.background.default,
      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${bg} 5px, ${bg} 10px)`,
    },
  }
})

const LinearSyntenyRendering = observer(function LinearSyntenyRendering({
  model,
}: {
  model: LinearSyntenyDisplayModel
}) {
  const { classes } = useStyles()
  const { mouseoverId, height } = model
  const view = getContainingView(model) as LinearSyntenyViewModel
  const width = view.width

  const gpuCanvasRef = useRef<HTMLCanvasElement>(null)
  const initStarted = useRef(false)
  const canvasRectRef = useRef<DOMRect | null>(null)
  const xOffset = useRef(0)
  const scheduled = useRef(false)
  const zoomDelta = useRef(0)
  const zoomScheduled = useRef(false)
  const lastZoomClientX = useRef(0)
  const mouseCurrDownX = useRef<number | undefined>(undefined)
  const mouseInitialDownX = useRef<number | undefined>(undefined)

  const [anchorEl, setAnchorEl] = useState<ClickCoord>()
  const [tooltip, setTooltip] = useState('')
  const [gpuReady, setGpuReady] = useState(false)

  useEffect(() => {
    canvasRectRef.current = null
  }, [height, width])

  function getCanvasRect() {
    if (!canvasRectRef.current) {
      canvasRectRef.current =
        gpuCanvasRef.current?.getBoundingClientRect() ?? null
    }
    return canvasRectRef.current
  }

  function getEventCanvasCoords(evt: { clientX: number; clientY: number }) {
    const rect = getCanvasRect()
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
            transaction(() => {
              for (const v of view.views) {
                v.zoomTo(
                  d > 0 ? v.bpPerPx * (1 + d) : v.bpPerPx / (1 - d),
                  lastZoomClientX.current - (getCanvasRect()?.left ?? 0),
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
  }, [model, height, width])

  const gpuCanvasCallbackRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      gpuCanvasRef.current = canvas
      if (!canvas || initStarted.current) {
        return
      }
      initStarted.current = true
      const renderer = SyntenyRenderer.getOrCreate(canvas)
      renderer
        .init()
        .then(success => {
          if (!success) {
            console.error('[LinearSyntenyRendering] GPU initialization failed')
          }
          model.setGpuRenderer(renderer)
          model.setGpuInitialized(success)
          setGpuReady(success)
        })
        .catch((e: unknown) => {
          console.error('[LinearSyntenyRendering] GPU initialization error:', e)
          model.setGpuInitialized(false)
          setGpuReady(false)
        })
    },
    [model],
  )

  const pickFeature = useCallback(
    (x: number, y: number) => {
      if (model.gpuRenderer && model.gpuInitialized) {
        const featureIndex = model.gpuRenderer.pick(x, y)
        if (
          featureIndex !== undefined &&
          featureIndex >= 0 &&
          featureIndex < model.numFeats
        ) {
          return model.getFeature(featureIndex)
        }
      }
      return undefined
    },
    [model],
  )

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
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
        model.setMouseoverId(undefined)
        model.setHoveredFeatureIdx(-1)
        setTooltip('')
      } else {
        const applyHover = (featureIndex: number) => {
          model.setHoveredFeatureIdx(featureIndex)
          if (featureIndex >= 0 && featureIndex < model.numFeats) {
            const feat = model.getFeature(featureIndex)
            if (feat) {
              model.setMouseoverId(feat.id)
              setTooltip(getTooltip(feat))
            }
          } else {
            model.setMouseoverId(undefined)
            setTooltip('')
          }
        }
        const featureIndex = model.gpuRenderer?.pick(
          coords.x,
          coords.y,
          applyHover,
        )
        if (featureIndex !== undefined) {
          applyHover(featureIndex)
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, model],
  )

  const handleMouseLeave = useCallback(() => {
    model.setMouseoverId(undefined)
    model.setHoveredFeatureIdx(-1)
    mouseInitialDownX.current = undefined
    mouseCurrDownX.current = undefined
    model.setIsScrolling(false)
  }, [model])

  const handleMouseDown = useCallback(
    (evt: React.MouseEvent) => {
      mouseCurrDownX.current = evt.clientX
      mouseInitialDownX.current = evt.clientX
      model.setIsScrolling(true)
    },
    [model],
  )

  const handleMouseUp = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      mouseCurrDownX.current = undefined
      model.setIsScrolling(false)
      if (
        mouseInitialDownX.current !== undefined &&
        Math.abs(evt.clientX - mouseInitialDownX.current) < 5
      ) {
        const coords = getEventCanvasCoords(evt)
        if (!coords || !model.gpuRenderer || !model.gpuInitialized) {
          return
        }
        const feat = pickFeature(coords.x, coords.y)
        if (feat) {
          const featureIndex = model.gpuRenderer.pick(coords.x, coords.y)
          if (featureIndex !== undefined) {
            model.setClickedFeatureIdx(featureIndex)
          }
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
        } else {
          model.setClickedFeatureIdx(-1)
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, pickFeature],
  )

  const handleContextMenu = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!model.gpuRenderer || !model.gpuInitialized) {
        return
      }
      evt.preventDefault()
      const coords = getEventCanvasCoords(evt)
      if (!coords) {
        return
      }
      const feat = pickFeature(coords.x, coords.y)
      if (feat) {
        setAnchorEl({
          clientX: evt.clientX,
          clientY: evt.clientY,
          feature: feat,
        })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, pickFeature],
  )

  return (
    <div className={classes.rel}>
      <canvas
        ref={gpuCanvasCallbackRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        data-testid="synteny_canvas"
        className={classes.gpuCanvas}
        style={{ width, height }}
      />
      {!gpuReady ? (
        <div className={classes.gpuLoadingOverlay}>
          <LoadingEllipses message="Initializing GPU renderer" />
        </div>
      ) : null}
      {mouseoverId && tooltip ? <SyntenyTooltip title={tooltip} /> : null}
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
