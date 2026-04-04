import { useEffect, useMemo, useRef, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { Alert, useTheme } from '@mui/material'
import { autorun, computed, untracked } from 'mobx'
import { observer } from 'mobx-react'

import LoadingOverlay from './LoadingOverlay.tsx'
import SequenceLettersOverlay from './SequenceLettersOverlay.tsx'
import { createSequenceRenderer } from './SequenceRenderer.ts'
import {
  buildColorPalette,
  buildSequenceGeometry,
} from './sequenceGeometry.ts'

import type { SequenceBackend } from './sequenceBackendTypes.ts'
import type { LinearReferenceSequenceDisplayModel } from '../model.ts'
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
    showLoading,
    sequenceType,
    rowHeight,
  } = model
  const view = getContainingView(model) as LinearGenomeViewModel
  const theme = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<SequenceBackend | null>(null)
  const instanceCountRef = useRef(0)
  const baseBpRef = useRef(0)
  const [initReady, setInitReady] = useState(0)

  const palette = useMemo(() => buildColorPalette(theme), [theme])

  const showBordersComputed = useMemo(
    () => computed(() => 1 / view.bpPerPx >= 12),
    [view],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    let cancelled = false
    let backend: SequenceBackend | null = null
    createSequenceRenderer(canvas)
      .then(b => {
        if (cancelled) {
          b.dispose()
          return
        }
        backend = b
        rendererRef.current = b
        setInitReady(v => v + 1)
      })
      .catch((e: unknown) => {
        console.error('[WebGLSequenceComponent] renderer initialization error:', e)
      })
    return () => {
      cancelled = true
      if (backend) {
        backend.dispose()
      }
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!initReady) {
      return
    }
    const disposer = autorun(
      function sequenceGeometryAutorun() {
        const renderer = rendererRef.current
        if (!renderer) {
          return
        }

        const regionEntries = [...sequenceData.entries()]
        if (regionEntries.length === 0) {
          instanceCountRef.current = 0
          return
        }

        const showBorders = showBordersComputed.get()
        const settings = {
          showForward: showForwardActual,
          showReverse: showReverseActual,
          showTranslation: showTranslationActual,
          sequenceType,
          rowHeight,
          colorByCDS: false,
          showBorders,
        }

        const baseBp = Math.min(...regionEntries.map(([, d]) => d.start))
        baseBpRef.current = baseBp

        let totalRects = 0
        const allGeom: {
          rectBuf: Float32Array
          colorBuf: Uint8Array
          instanceCount: number
        }[] = []

        for (const [regionNumber, data] of regionEntries) {
          const reversed =
            view.displayedRegions[regionNumber]?.reversed ?? false
          const geom = buildSequenceGeometry(
            data,
            settings,
            reversed,
            palette,
            baseBp,
          )
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
          renderer.uploadGeometry(mergedRects, mergedColors, totalRects)
        } else {
          renderer.uploadGeometry(new Float32Array(0), new Uint8Array(0), 0)
        }
        instanceCountRef.current = totalRects

        untracked(() => {
          const cssWidth = view.trackWidthPx
          const cssHeight = model.height
          if (cssWidth > 0 && cssHeight > 0) {
            const basePx = baseBpRef.current / view.bpPerPx - view.offsetPx
            renderer.render(
              totalRects,
              basePx,
              view.bpPerPx,
              cssWidth,
              cssHeight,
            )
          }
        })
      },
      { name: 'SequenceGeometryAutorun' },
    )
    return () => {
      disposer()
    }
  }, [
    model.height,
    sequenceData,
    showForwardActual,
    showReverseActual,
    showTranslationActual,
    sequenceType,
    rowHeight,
    palette,
    view,
    showBordersComputed,
    initReady,
  ])

  useEffect(() => {
    if (!initReady) {
      return
    }
    const disposer = autorun(
      function sequenceRenderAutorun() {
        const renderer = rendererRef.current
        if (!renderer) {
          return
        }
        const { bpPerPx, offsetPx } = view
        const cssWidth = view.trackWidthPx
        const cssHeight = model.height
        if (cssWidth > 0 && cssHeight > 0) {
          const basePx = baseBpRef.current / bpPerPx - offsetPx
          renderer.render(
            instanceCountRef.current,
            basePx,
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
  }, [view, model, initReady])

  if (error) {
    return <Alert severity="error">{`${error}`}</Alert>
  }

  const zoomedOut = view.bpPerPx > 10

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: zoomedOut || showLoading ? 'none' : 'block',
        }}
      />
      {zoomedOut ? (
        <Alert severity="info">Zoom in to see sequence</Alert>
      ) : (
        <>
          <LoadingOverlay isVisible={showLoading} />
          {!showLoading ? (
            <SequenceLettersOverlay
              sequenceData={sequenceData}
              offsetPx={view.offsetPx}
              bpPerPx={view.bpPerPx}
              rowHeight={rowHeight}
              showForward={showForwardActual}
              showReverse={showReverseActual}
              showTranslation={showTranslationActual}
              sequenceType={sequenceType}
              displayedRegions={view.displayedRegions}
              width={view.trackWidthPx}
              totalHeight={height}
            />
          ) : null}
        </>
      )}
    </div>
  )
})

export default WebGLSequenceComponent
