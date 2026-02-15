import type React from 'react'
import { lazy, useCallback, useEffect, useRef, useState } from 'react'

import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
  setupWebGLContextLossHandler,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'

import { SyntenyWebGLRenderer } from '../drawSyntenyWebGL.ts'
import SyntenyContextMenu from './SyntenyContextMenu.tsx'
import { getTooltip } from './util.ts'

import type { ClickCoord } from './util.ts'
import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'
import type { LinearSyntenyDisplayModel } from '../model.ts'

const SyntenyTooltip = lazy(() => import('./SyntenyTooltip.tsx'))

const useStyles = makeStyles()({
  rel: {
    position: 'relative',
  },
  mouseoverCanvas: {
    position: 'absolute',
    pointerEvents: 'none',
  },
  webglCanvas: {
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
  const { mouseoverId, height } = model
  const xOffset = useRef(0)
  const view = getContainingView(model) as LinearSyntenyViewModel
  const width = view.width
  const scheduled = useRef(false)
  const zoomDelta = useRef(0)
  const zoomScheduled = useRef(false)
  const lastZoomClientX = useRef(0)
  const canvasRectRef = useRef<DOMRect | null>(null)
  const [anchorEl, setAnchorEl] = useState<ClickCoord>()
  const [tooltip, setTooltip] = useState('')
  const [currX, setCurrX] = useState<number>()
  const [mouseCurrDownX, setMouseCurrDownX] = useState<number>()
  const [mouseInitialDownX, setMouseInitialDownX] = useState<number>()
  const [currY, setCurrY] = useState<number>()
  const webglCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    canvasRectRef.current = null
  }, [height, width])

  // these useCallbacks avoid new refs from being created on any mouseover,
  // etc.
  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const mouseoverDetectionCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setMouseoverCanvasRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, height, width],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  useEffect(() => {
    let scrollingTimer: ReturnType<typeof setTimeout> | undefined
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      for (const v of view.views) {
        ;(
          v as unknown as { setIsScrolling?: (val: boolean) => void }
        ).setIsScrolling?.(true)
      }
      model.setIsScrolling(true)
      clearTimeout(scrollingTimer)
      scrollingTimer = setTimeout(() => {
        for (const v of view.views) {
          ;(
            v as unknown as { setIsScrolling?: (val: boolean) => void }
          ).setIsScrolling?.(false)
        }
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
                  lastZoomClientX.current -
                    (canvasRectRef.current?.left ??
                      webglCanvasRef.current?.getBoundingClientRect().left ??
                      0),
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
        if (!scheduled.current) {
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
      }
    }
    const target = webglCanvasRef.current
    target?.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      target?.removeEventListener('wheel', onWheel)
      clearTimeout(scrollingTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, height, width])

  useEffect(() => {
    const canvas = webglCanvasRef.current
    if (canvas) {
      const lostHandler = (event: Event) => {
        console.error('[WebGL Synteny] Context lost!', {
          canvasSize: `${canvas.width}x${canvas.height}`,
          clientSize: `${canvas.clientWidth}x${canvas.clientHeight}`,
          instanceCount: model.webglRenderer?.getInstanceCount(),
          event,
        })
        if (model.webglRenderer) {
          model.webglRenderer.dispose()
        }
      }

      const restoredHandler = () => {
        console.log('[WebGL Synteny] Context restored, reinitializing...')
        const newRenderer = new SyntenyWebGLRenderer()
        const success = newRenderer.init(canvas)
        model.setWebGLRenderer(newRenderer)
        model.setWebGLInitialized(success)
        if (success) {
          console.log('[WebGL Synteny] Context successfully restored')
        } else {
          console.error('[WebGL Synteny] Failed to restore context')
        }
      }

      canvas.addEventListener('webglcontextlost', lostHandler)
      canvas.addEventListener('webglcontextrestored', restoredHandler)

      return () => {
        canvas.removeEventListener('webglcontextlost', lostHandler)
        canvas.removeEventListener('webglcontextrestored', restoredHandler)
      }
    }
    return undefined
  }, [model])

  // Initialize/dispose WebGL renderer
  // biome-ignore lint/correctness/useExhaustiveDependencies:
  useEffect(() => {
    if (webglCanvasRef.current) {
      const renderer = new SyntenyWebGLRenderer()
      const success = renderer.init(webglCanvasRef.current)
      model.setWebGLRenderer(renderer)
      model.setWebGLInitialized(success)
      return () => {
        model.webglRenderer?.dispose()
        model.setWebGLRenderer(null)
        model.setWebGLInitialized(false)
      }
    }
    return undefined
  }, [model, width, height])

  const handleWebGLPick = useCallback(
    (x: number, y: number) => {
      if (model.webglRenderer && model.webglInitialized) {
        const featureIndex = model.webglRenderer.pick(x, y)
        if (featureIndex >= 0 && featureIndex < model.featPositions.length) {
          return model.featPositions[featureIndex]
        }
      }
      return undefined
    },
    [model],
  )

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (mouseCurrDownX !== undefined) {
        xOffset.current += mouseCurrDownX - event.clientX
        setMouseCurrDownX(event.clientX)
        if (!scheduled.current) {
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
        return
      }

      const { clientX, clientY } = event
      const canvas = webglCanvasRef.current
      if (!canvas) {
        return
      }
      let rect = canvasRectRef.current
      if (!rect) {
        rect = canvas.getBoundingClientRect()
        canvasRectRef.current = rect
      }
      const x = clientX - rect.left
      const y = clientY - rect.top
      setCurrX(clientX)
      setCurrY(clientY)

      if (model.isScrolling) {
        model.setMouseoverId(undefined)
        setTooltip('')
      } else {
        const feat = handleWebGLPick(x, y)
        if (feat) {
          model.setMouseoverId(feat.id)
          setTooltip(getTooltip(feat))
        } else {
          model.setMouseoverId(undefined)
          setTooltip('')
        }
      }
    },
    [view, model, mouseCurrDownX, handleWebGLPick],
  )

  const handleMouseLeave = useCallback(() => {
    model.setMouseoverId(undefined)
    setMouseInitialDownX(undefined)
    setMouseCurrDownX(undefined)
    model.setIsScrolling(false)
  }, [model])

  const handleMouseDown = useCallback(
    (evt: React.MouseEvent) => {
      setMouseCurrDownX(evt.clientX)
      setMouseInitialDownX(evt.clientX)
      model.setIsScrolling(true)
    },
    [model],
  )

  const handleMouseUp = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      setMouseCurrDownX(undefined)
      model.setIsScrolling(false)
      if (
        mouseInitialDownX !== undefined &&
        Math.abs(evt.clientX - mouseInitialDownX) < 5
      ) {
        const canvas = webglCanvasRef.current
        if (canvas && model.webglRenderer && model.webglInitialized) {
          let rect = canvasRectRef.current
          if (!rect) {
            rect = canvas.getBoundingClientRect()
            canvasRectRef.current = rect
          }
          const x = evt.clientX - rect.left
          const y = evt.clientY - rect.top
          const feat = handleWebGLPick(x, y)
          if (feat) {
            model.setClickId(feat.id)
            const session = getSession(model)
            if (isSessionModelWithWidgets(session)) {
              const containingView = getContainingView(model)
              const track = getContainingTrack(model)
              session.showWidget(
                session.addWidget('SyntenyFeatureWidget', 'syntenyFeature', {
                  view: containingView,
                  track,
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
        }
      }
    },
    [model, mouseInitialDownX, handleWebGLPick],
  )

  const handleContextMenu = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (model.webglRenderer && model.webglInitialized) {
        evt.preventDefault()
        const canvas = webglCanvasRef.current
        if (canvas) {
          let rect = canvasRectRef.current
          if (!rect) {
            rect = canvas.getBoundingClientRect()
            canvasRectRef.current = rect
          }
          const x = evt.clientX - rect.left
          const y = evt.clientY - rect.top
          const feat = handleWebGLPick(x, y)
          if (feat) {
            model.setClickId(feat.id)
            setAnchorEl({
              clientX: evt.clientX,
              clientY: evt.clientY,
              feature: feat,
            })
          }
        }
      }
    },
    [model, handleWebGLPick],
  )

  return (
    <div className={classes.rel}>
      <canvas
        ref={webglCanvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        data-testid="synteny_canvas"
        className={classes.webglCanvas}
        width={width * 2}
        height={height * 2}
        style={{ width, height }}
      />
      <canvas
        ref={mouseoverDetectionCanvasRef}
        width={width}
        height={height}
        className={classes.mouseoverCanvas}
      />
      {mouseoverId && tooltip && currX && currY ? (
        <SyntenyTooltip title={tooltip} />
      ) : null}
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
