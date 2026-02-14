import { useEffect, useMemo, useRef, useState } from 'react'

import {
  getContainingView,
  setupWebGLContextLossHandler,
} from '@jbrowse/core/util'
import { Alert, useTheme } from '@mui/material'
import { autorun, computed, untracked } from 'mobx'
import { observer } from 'mobx-react'

import LoadingOverlay from './LoadingOverlay.tsx'
import SequenceLettersOverlay from './SequenceLettersOverlay.tsx'
import {
  buildColorPalette,
  buildSequenceGeometry,
  disposeGL,
  initGL,
  render,
  uploadGeometry,
} from './drawSequenceWebGL.ts'

import type { LinearReferenceSequenceDisplayModel } from '../model.ts'
import type { GLHandles } from './drawSequenceWebGL.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const WebGLSequenceComponent = observer(function WebGLSequenceComponent({
  model,
}: {
  model: LinearReferenceSequenceDisplayModel
}) {
  const {
    height,
    sequenceData,
    error,
    showForwardActual,
    showReverseActual,
    showTranslationActual,
    sequenceType,
    rowHeight,
  } = model
  const view = getContainingView(model) as LinearGenomeViewModel
  const theme = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGL2RenderingContext | null>(null)
  const handlesRef = useRef<GLHandles | null>(null)
  const instanceCountRef = useRef(0)
  const [contextVersion, setContextVersion] = useState(0)

  const palette = useMemo(() => buildColorPalette(theme), [theme])

  // compute thresholds as mobx computed values so geometry autorun
  // only re-fires when these booleans actually change, not on every
  // fractional bpPerPx change during zoom
  const showSequenceComputed = useMemo(
    () => computed(() => view.bpPerPx <= 1),
    [view],
  )
  const showBordersComputed = useMemo(
    () => computed(() => 1 / view.bpPerPx >= 12),
    [view],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      return setupWebGLContextLossHandler(canvas, () => {
        setContextVersion(v => v + 1)
      })
    }
    return undefined
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const gl = canvas.getContext('webgl2')
    if (!gl) {
      console.error('WebGL2 not supported')
      return
    }
    glRef.current = gl
    handlesRef.current = initGL(gl)
    return () => {
      if (glRef.current && handlesRef.current) {
        disposeGL(glRef.current, handlesRef.current)
      }
      glRef.current = null
      handlesRef.current = null
    }
  }, [contextVersion])

  // geometry autorun: rebuilds typed arrays when data/settings change
  useEffect(() => {
    const disposer = autorun(
      function sequenceGeometryAutorun() {
        const gl = glRef.current
        const handles = handlesRef.current
        if (!gl || !handles) {
          return
        }

        const regionEntries = [...sequenceData.entries()]
        if (regionEntries.length === 0) {
          instanceCountRef.current = 0
          return
        }

        const showSequence = showSequenceComputed.get()
        const showBorders = showBordersComputed.get()
        const region = view.displayedRegions[0]
        const reversed = region?.reversed ?? false
        const settings = {
          showForward: showForwardActual,
          showReverse: showReverseActual,
          showTranslation: showTranslationActual,
          sequenceType,
          rowHeight,
          reversed,
          colorByCDS: false,
          showSequence,
          showBorders,
        }

        let totalRects = 0
        const allGeom: {
          rectBuf: Float32Array
          colorBuf: Uint8Array
          instanceCount: number
        }[] = []

        for (const [, data] of regionEntries) {
          const geom = buildSequenceGeometry(data, settings, palette)
          allGeom.push(geom)
          totalRects += geom.instanceCount
        }

        if (totalRects > 0) {
          const mergedRects = new Float32Array(totalRects * 4)
          const mergedColors = new Uint8Array(totalRects * 4)
          let offset = 0
          for (const g of allGeom) {
            mergedRects.set(g.rectBuf, offset * 4)
            mergedColors.set(g.colorBuf, offset * 4)
            offset += g.instanceCount
          }
          uploadGeometry(gl, handles, mergedRects, mergedColors)
        }
        instanceCountRef.current = totalRects

        // render immediately after geometry upload so settings changes are visible
        // (the render autorun only tracks offsetPx/bpPerPx)
        // use untracked to avoid this autorun also tracking scroll position
        untracked(() => {
          const canvas = canvasRef.current
          if (canvas) {
            const cssWidth = canvas.clientWidth
            const cssHeight = canvas.clientHeight
            if (cssWidth > 0 && cssHeight > 0) {
              render(
                gl,
                handles,
                totalRects,
                view.offsetPx,
                view.bpPerPx,
                cssWidth,
                cssHeight,
              )
            }
          }
        })
      },
      { name: 'SequenceGeometryAutorun' },
    )
    return () => {
      disposer()
    }
  }, [
    sequenceData,
    showForwardActual,
    showReverseActual,
    showTranslationActual,
    sequenceType,
    rowHeight,
    palette,
    view,
    showSequenceComputed,
    showBordersComputed,
    contextVersion,
  ])

  // render autorun: redraws on scroll/zoom/resize, does NOT rebuild geometry
  useEffect(() => {
    const disposer = autorun(
      function sequenceRenderAutorun() {
        const gl = glRef.current
        const handles = handlesRef.current
        const canvas = canvasRef.current
        if (!gl || !handles || !canvas) {
          return
        }
        const { bpPerPx, offsetPx } = view
        const cssWidth = canvas.clientWidth
        const cssHeight = canvas.clientHeight
        if (cssWidth > 0 && cssHeight > 0) {
          render(
            gl,
            handles,
            instanceCountRef.current,
            offsetPx,
            bpPerPx,
            cssWidth,
            cssHeight,
          )
        }
      },
      { name: 'SequenceRenderAutorun' },
    )
    return () => {
      disposer()
    }
  }, [view, height, contextVersion])

  if (error) {
    return <Alert severity="error">{`${error}`}</Alert>
  }

  const zoomedOut = view.bpPerPx > 3
  const viewWidth = view.width
  const firstRegion = view.displayedRegions[0]
  const reversed = firstRegion?.reversed ?? false

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: zoomedOut ? 'none' : 'block',
        }}
      />
      {zoomedOut ? (
        <Alert severity="info">Zoom in to see sequence</Alert>
      ) : (
        <>
          <LoadingOverlay isVisible={sequenceData.size === 0} />
          {sequenceData.size > 0 ? (
            <SequenceLettersOverlay
              sequenceData={sequenceData}
              offsetPx={view.offsetPx}
              bpPerPx={view.bpPerPx}
              rowHeight={rowHeight}
              showForward={showForwardActual}
              showReverse={showReverseActual}
              showTranslation={showTranslationActual}
              sequenceType={sequenceType}
              reversed={reversed}
              width={viewWidth}
              totalHeight={height}
            />
          ) : null}
        </>
      )}
    </div>
  )
})

export default WebGLSequenceComponent
