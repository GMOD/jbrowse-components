import { lazy, useCallback, useEffect, useRef, useState } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'

import {
  MAX_COLOR_RANGE,
  getId,
  drawRef,
  drawCigarClickMap,
  drawMouseoverClickMap,
} from '../drawSynteny'
import SyntenyContextMenu from './SyntenyContextMenu'
import { getTooltip, onSynClick, onSynContextClick } from './util'

import type { DrawResultMessage } from '../syntenyRendererWorker'
import type { ClickCoord } from './util'
import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model'
import type { LinearSyntenyDisplayModel } from '../model'

const SyntenyTooltip = lazy(() => import('./SyntenyTooltip'))

type Timer = ReturnType<typeof setTimeout>

interface RenderedState {
  offsets: number[]
  bpPerPxs: number[]
}

function arraysEqual(a: number[], b: number[]) {
  return a.length === b.length && a.every((val, i) => val === b[i])
}

const useStyles = makeStyles()({
  pix: {
    imageRendering: 'pixelated',
    pointerEvents: 'none',
    visibility: 'hidden',
    position: 'absolute',
  },
  rel: {
    position: 'relative',
  },
  mouseoverCanvas: {
    position: 'absolute',
    pointEvents: 'none',
  },
  mainCanvas: {
    position: 'absolute',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    backgroundImage:
      'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0, 0, 0, 0.05) 8px, rgba(0, 0, 0, 0.05) 16px)',
    pointerEvents: 'none',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

const LinearSyntenyRendering = observer(function ({
  model,
}: {
  model: LinearSyntenyDisplayModel
}) {
  const { classes } = useStyles()
  const { mouseoverId, height } = model
  const xOffset = useRef(0)
  const view = getContainingView(model) as LinearSyntenyViewModel
  const width = view.width
  const delta = useRef(0)
  const scheduled = useRef(false)
  const timeout = useRef<Timer>(null)
  const [anchorEl, setAnchorEl] = useState<ClickCoord>()
  const [tooltip, setTooltip] = useState('')
  const [currX, setCurrX] = useState<number>()
  const [mouseCurrDownX, setMouseCurrDownX] = useState<number>()
  const [mouseInitialDownX, setMouseInitialDownX] = useState<number>()
  const [currY, setCurrY] = useState<number>()
  const mainSyntenyCanvasRefp = useRef<HTMLCanvasElement>(null)

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

  const workerRef = useRef<Worker | null>(null)
  const renderingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const [lastRenderedState, setLastRenderedState] = useState<RenderedState>()
  const [showStaleIndicator, setShowStaleIndicator] = useState(false)
  const staleTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  const mainSyntenyCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setMainCanvasRef(ref)
      mainSyntenyCanvasRefp.current = ref
    },
    [model],
  )

  // Handle worker lifecycle based on useWebWorker setting
  useEffect(() => {
    const ref = mainSyntenyCanvasRefp.current
    // Set up worker - only when useWebWorker is enabled
    if (
      ref &&
      !workerRef.current &&
      typeof OffscreenCanvas !== 'undefined' &&
      view.useWebWorker
    ) {
      const worker = new Worker(
        new URL('../syntenyRendererWorker', import.meta.url),
      )

      worker.onmessage = (e: MessageEvent<DrawResultMessage>) => {
        // Clear the loading overlay timeout and hide overlay
        clearTimeout(renderingTimeoutRef.current)
        renderingTimeoutRef.current = undefined
        model.setIsRendering(false)

        // Store the rendered state for comparison
        setLastRenderedState({
          offsets: e.data.offsets,
          bpPerPxs: e.data.bpPerPxs,
        })

        // Draw the main bitmap onto the visible canvas
        // Using 'copy' composite operation for atomic replacement (no flash)
        const mainCtx = model.mainCanvas?.getContext('2d')
        if (mainCtx) {
          mainCtx.globalCompositeOperation = 'copy'
          mainCtx.drawImage(e.data.mainBitmap, 0, 0)
          mainCtx.globalCompositeOperation = 'source-over'
          e.data.mainBitmap.close()
        }

        // Draw the click map bitmaps onto the main thread canvases
        const clickMapCtx = model.clickMapCanvas?.getContext('2d')
        const cigarClickMapCtx = model.cigarClickMapCanvas?.getContext('2d')

        if (clickMapCtx) {
          clickMapCtx.clearRect(
            0,
            0,
            model.clickMapCanvas!.width,
            model.clickMapCanvas!.height,
          )
          clickMapCtx.drawImage(e.data.clickMapBitmap, 0, 0)
          e.data.clickMapBitmap.close()
        }

        if (cigarClickMapCtx) {
          cigarClickMapCtx.clearRect(
            0,
            0,
            model.cigarClickMapCanvas!.width,
            model.cigarClickMapCanvas!.height,
          )
          cigarClickMapCtx.drawImage(e.data.cigarClickMapBitmap, 0, 0)
          e.data.cigarClickMapBitmap.close()
        }
      }

      // Intercept postMessage to track when rendering starts
      const originalPostMessage = worker.postMessage.bind(worker)
      // @ts-expect-error overriding postMessage with simplified signature
      worker.postMessage = (message: unknown, transfer?: Transferable[]) => {
        if (
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          message.type === 'draw'
        ) {
          // Clear any existing timeout
          clearTimeout(renderingTimeoutRef.current)
          // Show loading overlay after 50ms if rendering hasn't completed
          renderingTimeoutRef.current = setTimeout(() => {
            model.setIsRendering(true)
          }, 50)
        }
        if (transfer) {
          originalPostMessage(message, transfer)
        } else {
          originalPostMessage(message)
        }
      }

      workerRef.current = worker
      model.setWorker(worker)
    }

    // Clean up worker if useWebWorker was toggled off
    if (!view.useWebWorker && workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
      model.setWorker(null)
    }
  }, [model, view.useWebWorker])

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  useEffect(() => {
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      if (event.ctrlKey) {
        delta.current += event.deltaY / 500
        for (const v of view.views) {
          v.setScaleFactor(
            delta.current < 0 ? 1 - delta.current : 1 / (1 + delta.current),
          )
        }
        if (timeout.current) {
          clearTimeout(timeout.current)
        }
        timeout.current = setTimeout(() => {
          for (const v of view.views) {
            v.setScaleFactor(1)
            v.zoomTo(
              delta.current > 0
                ? v.bpPerPx * (1 + delta.current)
                : v.bpPerPx / (1 - delta.current),
              event.clientX -
                (mainSyntenyCanvasRefp.current?.getBoundingClientRect().left ||
                  0),
            )
          }
          delta.current = 0
        }, 300)
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
    mainSyntenyCanvasRefp.current?.addEventListener('wheel', onWheel)
    return () => {
      mainSyntenyCanvasRefp.current?.removeEventListener('wheel', onWheel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, height, width])

  // Main-thread rendering when web worker is disabled
  // Uses JSON.stringify for offset/bpPerPx arrays since React requires static dependency arrays
  const offsetsKey = JSON.stringify(view.views.map(v => v.offsetPx))
  const bpPerPxsKey = JSON.stringify(view.views.map(v => v.bpPerPx))

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  useEffect(() => {
    if (view.useWebWorker) {
      return
    }
    if (!model.mainCanvas || !model.clickMapCanvas || !model.cigarClickMapCanvas) {
      return
    }
    if (model.featPositions.length === 0) {
      return
    }

    const mainCtx = model.mainCanvas.getContext('2d')
    if (!mainCtx) {
      return
    }

    mainCtx.clearRect(0, 0, width, height)
    drawRef(model, mainCtx)
    drawCigarClickMap(model, model.cigarClickMapCanvas.getContext('2d')!)

    // Update rendered state for stale indicator
    setLastRenderedState({
      offsets: view.views.map(v => v.offsetPx),
      bpPerPxs: view.views.map(v => v.bpPerPx),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    view.useWebWorker,
    model.featPositions,
    model.alpha,
    model.minAlignmentLength,
    model.colorBy,
    view.drawCurves,
    view.drawCIGAR,
    view.drawCIGARMatchesOnly,
    view.drawLocationMarkers,
    offsetsKey,
    bpPerPxsKey,
    width,
    height,
  ])

  // Draw mouseover/click highlighting - runs on main thread regardless of worker setting
  // biome-ignore lint/correctness/useExhaustiveDependencies:
  useEffect(() => {
    if (!model.mouseoverCanvas) {
      return
    }
    drawMouseoverClickMap(model)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.mouseoverId, model.clickId, model.featPositions, offsetsKey])

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const clickMapCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setClickMapCanvasRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, height, width],
  )
  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const cigarClickMapCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setCigarClickMapCanvasRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, height, width],
  )

  const currentOffsets = view.views.map(v => v.offsetPx)
  const currentBpPerPxs = view.views.map(v => v.bpPerPx)
  const isStale =
    lastRenderedState !== undefined &&
    (!arraysEqual(currentOffsets, lastRenderedState.offsets) ||
      !arraysEqual(currentBpPerPxs, lastRenderedState.bpPerPxs))

  useEffect(() => {
    if (isStale) {
      staleTimeoutRef.current = setTimeout(() => {
        setShowStaleIndicator(true)
      }, 100)
    } else {
      clearTimeout(staleTimeoutRef.current)
      setShowStaleIndicator(false)
    }
    return () => {
      clearTimeout(staleTimeoutRef.current)
    }
  }, [isStale])

  return (
    <div className={classes.rel} style={{ width, height }}>
      <canvas
        ref={mouseoverDetectionCanvasRef}
        width={width}
        height={height}
        className={classes.mouseoverCanvas}
      />
      <canvas
        ref={mainSyntenyCanvasRef}
        onMouseMove={event => {
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
          } else {
            const ref1 = model.clickMapCanvas
            const ref2 = model.cigarClickMapCanvas
            if (!ref1 || !ref2) {
              return
            }
            const rect = ref1.getBoundingClientRect()
            const ctx1 = ref1.getContext('2d')
            const ctx2 = ref2.getContext('2d')
            if (!ctx1 || !ctx2) {
              return
            }
            const { clientX, clientY } = event
            const x = clientX - rect.left
            const y = clientY - rect.top
            setCurrX(clientX)
            setCurrY(clientY)
            const [r1, g1, b1] = ctx1.getImageData(x, y, 1, 1).data
            const [r2, g2, b2] = ctx2.getImageData(x, y, 1, 1).data
            const unitMultiplier = Math.floor(MAX_COLOR_RANGE / model.numFeats)
            const id = getId(r1!, g1!, b1!, unitMultiplier)
            model.setMouseoverId(model.featPositions[id]?.f.id())
            if (id === -1) {
              setTooltip('')
            } else if (model.featPositions[id]) {
              const { f, cigar } = model.featPositions[id]
              const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)
              const cigarIdx = getId(r2!, g2!, b2!, unitMultiplier2)
              // this is hacky but the index sometimes returns odd number which
              // is invalid due to the color-to-id mapping, check it is even to
              // ensure better validity
              // Also check that the CIGAR pixel data is not all zeros (no CIGAR data drawn)
              if (cigarIdx % 2 === 0 && (r2 !== 0 || g2 !== 0 || b2 !== 0)) {
                setTooltip(
                  getTooltip({
                    feature: f,
                    cigarOp: cigar[cigarIdx + 1],
                    cigarOpLen: cigar[cigarIdx],
                  }),
                )
              } else {
                setTooltip('')
              }
            }
          }
        }}
        onMouseLeave={() => {
          model.setMouseoverId(undefined)
          setMouseInitialDownX(undefined)
          setMouseCurrDownX(undefined)
        }}
        onMouseDown={evt => {
          setMouseCurrDownX(evt.clientX)
          setMouseInitialDownX(evt.clientX)
        }}
        onMouseUp={evt => {
          setMouseCurrDownX(undefined)
          if (
            mouseInitialDownX !== undefined &&
            Math.abs(evt.clientX - mouseInitialDownX) < 5
          ) {
            onSynClick(evt, model)
          }
        }}
        onContextMenu={evt => {
          onSynContextClick(evt, model, setAnchorEl)
        }}
        data-testid="synteny_canvas"
        className={classes.mainCanvas}
        width={width}
        height={height}
      />
      <canvas
        ref={clickMapCanvasRef}
        className={classes.pix}
        width={width}
        height={height}
      />
      <canvas
        ref={cigarClickMapCanvasRef}
        className={classes.pix}
        width={width}
        height={height}
      />
      {model.isRendering || showStaleIndicator ? (
        <div className={classes.loadingOverlay}>
          <LoadingEllipses message="Rendering" />
        </div>
      ) : null}
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
