import { useCallback, useEffect, useRef, useState } from 'react'

import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { autorun } from 'mobx'

import { getBpDisplayStr, getContainingView } from '@jbrowse/core/util'

import { MultiSyntenyRenderer } from './MultiSyntenyRenderer.ts'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface MultiSyntenyModel {
  genomeRows: Map<string, MultiPairFeature[]>
  displayedGenomes: string[]
  rowHeight: number
  colorBy: string
  height: number
  snpBpPerPxThreshold: number
}

const LABEL_WIDTH = 120

const MultiSyntenyRendering = observer(function MultiSyntenyRendering({
  model,
}: {
  model: MultiSyntenyModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<MultiSyntenyRenderer | null>(null)
  const [ready, setReady] = useState(false)
  const [tooltip, setTooltip] = useState<{
    text: string
    open: boolean
  }>({ text: '', open: false })

  const view = getContainingView(model) as LinearGenomeViewModel

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    let cancelled = false
    const renderer = MultiSyntenyRenderer.getOrCreate(canvas)
    renderer
      .init()
      .then(() => {
        if (cancelled) {
          return
        }
        rendererRef.current = renderer
        setReady(true)
      })
      .catch((e: unknown) => {
        console.error('Failed to initialize multi-synteny renderer:', e)
      })
    return () => {
      cancelled = true
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
  }, [])

  // GPU path: upload geometry when features or colors change
  useEffect(() => {
    if (!ready) {
      return
    }
    return autorun(() => {
      const renderer = rendererRef.current
      if (renderer?.isGpu) {
        const { genomeRows, displayedGenomes, colorBy, snpBpPerPxThreshold } =
          model
        const showSnps =
          snpBpPerPxThreshold > 0 && view.bpPerPx < snpBpPerPxThreshold
        renderer.uploadGeometry(
          genomeRows,
          displayedGenomes,
          colorBy,
          showSnps,
        )
      }
    })
  }, [ready, model, view])

  // GPU path: render when view changes (scroll, zoom) or new data arrives
  useEffect(() => {
    if (!ready) {
      return
    }
    return autorun(() => {
      const renderer = rendererRef.current
      if (renderer?.isGpu) {
        const { height, rowHeight, genomeRows } = model
        // Track genomeRows so we re-render after new geometry is uploaded.
        // Without this, zoom-out fetches upload new geometry but never
        // trigger a render pass, leaving blank areas on screen.
        console.log(
          '[MultiSyntenyRendering] GPU render autorun fired, genomeRows size:',
          genomeRows.size,
        )
        const labelW = rowHeight >= 12 ? LABEL_WIDTH : 0
        const contentBlocks = view.staticBlocks.contentBlocks
        renderer.renderGpu(
          contentBlocks,
          view.offsetPx,
          view.width,
          height,
          rowHeight,
          labelW,
        )
      }
    })
  }, [ready, model, view])

  // Canvas2D fallback path
  useEffect(() => {
    if (!ready) {
      return
    }
    return autorun(() => {
      const renderer = rendererRef.current
      if (renderer && !renderer.isGpu) {
        const {
          genomeRows,
          displayedGenomes,
          colorBy,
          height,
          rowHeight,
          snpBpPerPxThreshold,
        } = model
        const { width, bpPerPx, offsetPx } = view
        const labelW = rowHeight >= 12 ? LABEL_WIDTH : 0
        const showSnps =
          snpBpPerPxThreshold > 0 && bpPerPx < snpBpPerPxThreshold
        const bpToPx = (refName: string, coord: number) => {
          const result = view.bpToPx({ refName, coord })
          if (result === undefined) {
            return undefined
          }
          return result.offsetPx - offsetPx
        }
        renderer.renderCanvas(genomeRows, displayedGenomes, {
          width,
          height,
          rowHeight,
          bpToPx,
          colorBy,
          labelW,
          showSnps,
        })
      }
    })
  }, [ready, model, view])

  // Read observables during render for tooltip/style (observer tracks these)
  const { genomeRows, displayedGenomes, rowHeight, height } = model
  const { width, bpPerPx, offsetPx } = view
  const labelW = rowHeight >= 12 ? LABEL_WIDTH : 0

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const genomeIdx = Math.floor(mouseY / rowHeight)
      if (genomeIdx < 0 || genomeIdx >= displayedGenomes.length) {
        setTooltip(t => (t.open ? { text: '', open: false } : t))
        return
      }
      const genomeName = displayedGenomes[genomeIdx]!
      const features = genomeRows.get(genomeName)
      if (!features) {
        setTooltip(t => (t.open ? { text: '', open: false } : t))
        return
      }

      for (const feat of features) {
        const px1 = view.bpToPx({ refName: feat.origRefName, coord: feat.start })
        const px2 = view.bpToPx({ refName: feat.origRefName, coord: feat.end })
        if (!px1 || !px2) {
          continue
        }
        const x1 = px1.offsetPx - offsetPx + labelW
        const x2 = px2.offsetPx - offsetPx + labelW
        if (mouseX >= x1 && mouseX <= x2) {
          const refSize = feat.end - feat.start
          const querySize = feat.mateEnd - feat.mateStart
          const lines = [
            genomeName,
            `Ref: ${feat.start.toLocaleString()}-${feat.end.toLocaleString()} (${getBpDisplayStr(refSize)})`,
            `Query: ${feat.mateRefName}:${feat.mateStart.toLocaleString()}-${feat.mateEnd.toLocaleString()} (${getBpDisplayStr(querySize)})`,
            feat.strand === -1 ? 'Inverted' : '',
            feat.syriType ? `Type: ${feat.syriType}` : '',
            feat.identity > 0
              ? `Identity: ${(feat.identity * 100).toFixed(1)}%`
              : '',
            feat.segmentId ? `Segment: ${feat.segmentId}` : '',
          ].filter(Boolean)
          setTooltip({ text: lines.join('\n'), open: true })
          return
        }
      }
      setTooltip(t => (t.open ? { text: '', open: false } : t))
    },
    [genomeRows, displayedGenomes, rowHeight, bpPerPx, offsetPx, labelW, view],
  )

  const onMouseLeave = useCallback(() => {
    setTooltip({ text: '', open: false })
  }, [])

  return (
    <Tooltip
      open={tooltip.open}
      title={
        <span style={{ whiteSpace: 'pre-line', fontSize: 12 }}>
          {tooltip.text}
        </span>
      }
      placement="right"
      followCursor
    >
      <canvas
        data-testid="multi_synteny_canvas"
        ref={canvasRef}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{
          width,
          height,
          display: 'block',
          cursor: tooltip.open ? 'pointer' : 'default',
        }}
      />
    </Tooltip>
  )
})

export default MultiSyntenyRendering
