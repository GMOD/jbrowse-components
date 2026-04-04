import { useEffect, useEffectEvent, useMemo, useRef } from 'react'

import { ErrorBar, ErrorOverlay } from '@jbrowse/core/ui'
import {
  getContainingView,
  useGpuRenderer,
  useTabVisibilityRerender,
} from '@jbrowse/core/util'
import { Alert, useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import LoadingOverlay from './LoadingOverlay.tsx'
import SequenceLettersOverlay from './SequenceLettersOverlay.tsx'
import { SequenceRenderer } from './SequenceRenderer.ts'
import { buildColorPalette, buildSequenceGeometry } from './sequenceGeometry.ts'

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

  const palette = useMemo(() => buildColorPalette(theme), [theme])

  const {
    error: glError,
    ready,
    rendererRef,
    retry,
  } = useGpuRenderer(canvasRef, SequenceRenderer)

  const instanceCountRef = useRef(0)
  const baseBpRef = useRef(0)

  const renderNow = useEffectEvent(() => {
    const renderer = rendererRef.current
    const instanceCount = instanceCountRef.current
    const cssWidth = view.trackWidthPx
    const cssHeight = model.height
    if (!renderer || instanceCount === 0 || cssWidth === 0 || cssHeight === 0) {
      return
    }
    const basePx = baseBpRef.current / view.bpPerPx - view.offsetPx
    renderer.render(instanceCount, basePx, view.bpPerPx, cssWidth, cssHeight)
  })

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready) {
      return
    }

    let lastDataIdentity: unknown = null
    let lastSettingsKey = ''

    return autorun(function sequenceAutorun() {
      const data = model.sequenceData
      const regionEntries = [...data.entries()]

      if (regionEntries.length === 0) {
        instanceCountRef.current = 0
        return
      }

      const showBorders = 1 / view.bpPerPx >= 12
      const settingsKey = `${model.showForwardActual},${model.showReverseActual},${model.showTranslationActual},${model.sequenceType},${model.rowHeight},${showBorders}`

      if (lastDataIdentity !== data || lastSettingsKey !== settingsKey) {
        lastDataIdentity = data
        lastSettingsKey = settingsKey

        const settings = {
          showForward: model.showForwardActual,
          showReverse: model.showReverseActual,
          showTranslation: model.showTranslationActual,
          sequenceType: model.sequenceType,
          rowHeight: model.rowHeight,
          colorByCDS: false,
          showBorders,
        }

        baseBpRef.current = Math.min(...regionEntries.map(([, d]) => d.start))

        let totalRects = 0
        const allGeom: {
          rectBuf: Float32Array
          colorBuf: Uint8Array
          instanceCount: number
        }[] = []

        for (const [regionNumber, regionData] of regionEntries) {
          const reversed =
            view.displayedRegions[regionNumber]?.reversed ?? false
          const geom = buildSequenceGeometry(
            regionData,
            settings,
            reversed,
            palette,
            baseBpRef.current,
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
      }

      renderNow()
    })
  }, [model, view, palette, ready, rendererRef])

  useTabVisibilityRerender(renderNow)

  if (glError) {
    return (
      <ErrorOverlay
        error={glError}
        width="100%"
        height={height}
        onRetry={() => {
          retry()
        }}
      />
    )
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
      {error ? (
        <ErrorBar
          error={error}
          onRetry={() => {
            model.reload()
          }}
        />
      ) : null}
    </div>
  )
})

export default WebGLSequenceComponent
