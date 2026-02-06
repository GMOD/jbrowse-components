import type React from 'react'
import { lazy, useCallback, useEffect, useRef, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'

import { MAX_COLOR_RANGE, getId } from '../drawSynteny.ts'
import { SyntenyWebGLRenderer } from '../drawSyntenyWebGL.ts'
import SyntenyContextMenu from './SyntenyContextMenu.tsx'
import { getTooltip, onSynClick, onSynContextClick } from './util.ts'

import type { ClickCoord } from './util.ts'
import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'
import type { LinearSyntenyDisplayModel } from '../model.ts'

const SyntenyTooltip = lazy(() => import('./SyntenyTooltip.tsx'))

type Timer = ReturnType<typeof setTimeout>

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
    pointerEvents: 'none',
  },
  mainCanvas: {
    position: 'absolute',
  },
  webglCanvas: {
    position: 'absolute',
    imageRendering: 'auto',
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
  const webglCanvasRef = useRef<HTMLCanvasElement>(null)

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
  const mainSyntenyCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setMainCanvasRef(ref)
      mainSyntenyCanvasRefp.current = ref // this ref is additionally used in useEffect below
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, height, width],
  )
  // biome-ignore lint/correctness/useExhaustiveDependencies:
  useEffect(() => {
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      if (event.ctrlKey) {
        delta.current += event.deltaY / 500
        if (timeout.current) {
          clearTimeout(timeout.current)
        }
        timeout.current = setTimeout(() => {
          for (const v of view.views) {
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
    const target = view.useWebGL
      ? webglCanvasRef.current
      : mainSyntenyCanvasRefp.current
    target?.addEventListener('wheel', onWheel)
    return () => {
      target?.removeEventListener('wheel', onWheel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, height, width, view.useWebGL])

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

  // Initialize/dispose WebGL renderer
  // biome-ignore lint/correctness/useExhaustiveDependencies:
  useEffect(() => {
    if (view.useWebGL && webglCanvasRef.current) {
      console.log('[WebGL Synteny] useEffect: creating renderer', { width, height })
      const renderer = new SyntenyWebGLRenderer()
      const success = renderer.init(webglCanvasRef.current)
      model.setWebGLRenderer(renderer)
      model.setWebGLInitialized(success)
      if (!success) {
        console.warn('[Synteny] WebGL initialization failed, falling back to Canvas 2D')
      }
      return () => {
        renderer.dispose()
        model.setWebGLRenderer(null)
        model.setWebGLInitialized(false)
      }
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.useWebGL, model, width, height])

  const handleWebGLPick = useCallback(
    (x: number, y: number) => {
      if (view.useWebGL && model.webglRenderer && model.webglInitialized) {
        const featureIndex = model.webglRenderer.pick(x, y)
        if (featureIndex >= 0 && featureIndex < model.featPositions.length) {
          return model.featPositions[featureIndex]
        }
      }
      return undefined
    },
    [view.useWebGL, model],
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
      const canvas = view.useWebGL
        ? webglCanvasRef.current
        : mainSyntenyCanvasRefp.current
      if (!canvas) {
        return
      }
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      setCurrX(clientX)
      setCurrY(clientY)

      if (view.useWebGL && model.webglRenderer && model.webglInitialized) {
        const feat = handleWebGLPick(x, y)
        if (feat) {
          model.setMouseoverId(feat.f.id())
          setTooltip(getTooltip({ feature: feat.f }))
        } else {
          model.setMouseoverId(undefined)
          setTooltip('')
        }
        return
      }

      // Canvas 2D picking
      const ref1 = model.clickMapCanvas
      const ref2 = model.cigarClickMapCanvas
      if (!ref1 || !ref2) {
        return
      }
      const ctx1 = ref1.getContext('2d')
      const ctx2 = ref2.getContext('2d')
      if (!ctx1 || !ctx2) {
        return
      }
      const [r1, g1, b1] = ctx1.getImageData(x, y, 1, 1).data
      const [r2, g2, b2] = ctx2.getImageData(x, y, 1, 1).data
      if (model.numFeats === 0) {
        setTooltip('')
        return
      }
      const unitMultiplier = Math.floor(MAX_COLOR_RANGE / model.numFeats)
      const id = getId(r1!, g1!, b1!, unitMultiplier)
      model.setMouseoverId(model.featPositions[id]?.f.id())
      if (id === -1 || !model.featPositions[id]) {
        setTooltip('')
      } else {
        const { f, cigar } = model.featPositions[id]
        const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)
        const cigarIdx = getId(r2!, g2!, b2!, unitMultiplier2)
        // this is hacky but the index sometimes returns odd number which
        // is invalid due to the color-to-id mapping, check it is even to
        // ensure better validity
        // Also check that the CIGAR pixel data is not all zeros (no CIGAR data drawn)
        const hasCigarData =
          cigarIdx % 2 === 0 && (r2 !== 0 || g2 !== 0 || b2 !== 0)
        setTooltip(
          getTooltip({
            feature: f,
            cigarOp: hasCigarData ? cigar[cigarIdx + 1] : undefined,
            cigarOpLen: hasCigarData ? cigar[cigarIdx] : undefined,
          }),
        )
      }
    },
    [view, model, mouseCurrDownX, handleWebGLPick],
  )

  const handleMouseLeave = useCallback(() => {
    model.setMouseoverId(undefined)
    setMouseInitialDownX(undefined)
    setMouseCurrDownX(undefined)
  }, [model])

  const handleMouseDown = useCallback((evt: React.MouseEvent) => {
    setMouseCurrDownX(evt.clientX)
    setMouseInitialDownX(evt.clientX)
  }, [])

  const handleMouseUp = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      setMouseCurrDownX(undefined)
      if (
        mouseInitialDownX !== undefined &&
        Math.abs(evt.clientX - mouseInitialDownX) < 5
      ) {
        if (view.useWebGL && model.webglRenderer && model.webglInitialized) {
          const canvas = webglCanvasRef.current
          if (canvas) {
            const rect = canvas.getBoundingClientRect()
            const x = evt.clientX - rect.left
            const y = evt.clientY - rect.top
            const feat = handleWebGLPick(x, y)
            if (feat) {
              model.setClickId(feat.f.id())
            }
          }
        } else {
          onSynClick(evt, model)
        }
      }
    },
    [view.useWebGL, model, mouseInitialDownX, handleWebGLPick],
  )

  const handleContextMenu = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (view.useWebGL && model.webglRenderer && model.webglInitialized) {
        evt.preventDefault()
        const canvas = webglCanvasRef.current
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          const x = evt.clientX - rect.left
          const y = evt.clientY - rect.top
          const feat = handleWebGLPick(x, y)
          if (feat) {
            model.setClickId(feat.f.id())
            setAnchorEl({
              clientX: evt.clientX,
              clientY: evt.clientY,
              feature: feat,
            })
          }
        }
      } else {
        onSynContextClick(evt, model, setAnchorEl)
      }
    },
    [view.useWebGL, model, handleWebGLPick],
  )

  return (
    <div className={classes.rel}>
      {/* Canvas 2D rendering - hidden when WebGL is active */}
      {!view.useWebGL ? (
        <canvas
          ref={mainSyntenyCanvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onContextMenu={handleContextMenu}
          data-testid="synteny_canvas"
          className={classes.mainCanvas}
          width={width}
          height={height}
        />
      ) : null}
      {/* WebGL rendering canvas */}
      {view.useWebGL ? (
        <canvas
          ref={webglCanvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onContextMenu={handleContextMenu}
          data-testid="synteny_canvas_webgl"
          className={classes.webglCanvas}
          width={width * 2}
          height={height * 2}
          style={{ width, height }}
        />
      ) : null}
      <canvas
        ref={mouseoverDetectionCanvasRef}
        width={width}
        height={height}
        className={classes.mouseoverCanvas}
      />
      {/* Hidden canvases for Canvas 2D click detection */}
      {!view.useWebGL ? (
        <>
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
        </>
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
