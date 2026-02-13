import { useEffect, useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import SequenceLettersOverlay from './SequenceLettersOverlay.tsx'
import {
  SequenceWebGLRenderer,
  buildSequenceGeometry,
} from './drawSequenceWebGL.ts'

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
    sequenceType,
    rowHeight,
  } = model
  const view = getContainingView(model) as LinearGenomeViewModel
  const theme = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<SequenceWebGLRenderer | null>(null)

  if (view.bpPerPx > 3) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height,
          width: '100%',
        }}
      >
        Zoom in to see sequence
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height,
          width: '100%',
          color: 'red',
        }}
      >
        {`${error}`}
      </div>
    )
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
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
    rendererRef.current = new SequenceWebGLRenderer(gl)
    return () => {
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
  }, [])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const disposer = autorun(
      function sequenceWebGLDraw() {
        const canvas = canvasRef.current
        const renderer = rendererRef.current
        if (!canvas || !renderer) {
          return
        }
        const { bpPerPx, offsetPx } = view
        const dpr = window.devicePixelRatio || 1
        const displayWidth = canvas.clientWidth
        const displayHeight = canvas.clientHeight

        if (
          canvas.width !== displayWidth * dpr ||
          canvas.height !== displayHeight * dpr
        ) {
          canvas.width = displayWidth * dpr
          canvas.height = displayHeight * dpr
        }

        const regionEntries = [...sequenceData.entries()]
        if (regionEntries.length === 0) {
          renderer.render(0, 1)
          return
        }

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
        }

        let totalRects = 0
        const allGeom: {
          rectBuf: Float32Array
          colorBuf: Uint8Array
          instanceCount: number
        }[] = []

        for (const [, data] of regionEntries) {
          const geom = buildSequenceGeometry(data, settings, theme)
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
        }

        renderer.render(offsetPx * dpr, bpPerPx)
      },
      { name: 'SequenceWebGLDraw' },
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
    theme,
    view,
  ])

  const viewWidth = view.width
  const firstRegionData = [...sequenceData.values()][0]
  const firstRegion = view.displayedRegions[0]
  const reversed = firstRegion?.reversed ?? false

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
      {firstRegionData ? (
        <SequenceLettersOverlay
          seq={firstRegionData.seq}
          seqStart={firstRegionData.start}
          regionStart={firstRegion?.start ?? firstRegionData.start}
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
    </div>
  )
})

export default WebGLSequenceComponent
