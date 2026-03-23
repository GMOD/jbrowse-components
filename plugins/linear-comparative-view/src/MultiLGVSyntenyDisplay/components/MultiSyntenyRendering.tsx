import { useCallback, useEffect, useRef, useState } from 'react'

import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

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
  const { genomeRows, displayedGenomes, rowHeight, colorBy, height } = model
  const { width, bpPerPx, offsetPx, displayedRegions } = view
  const labelW = rowHeight >= 12 ? LABEL_WIDTH : 0
  const displayedRegionStart = displayedRegions[0]?.start ?? 0

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

  useEffect(() => {
    if (ready && rendererRef.current) {
      rendererRef.current.render(genomeRows, displayedGenomes, {
        width,
        height,
        rowHeight,
        bpPerPx,
        offsetPx,
        displayedRegionStart,
        colorBy,
        labelW,
      })
    }
  }, [
    ready,
    genomeRows,
    displayedGenomes,
    width,
    height,
    rowHeight,
    bpPerPx,
    offsetPx,
    displayedRegionStart,
    colorBy,
    labelW,
  ])

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
        const x1 = (feat.start - displayedRegionStart) / bpPerPx - offsetPx + labelW
        const x2 = (feat.end - displayedRegionStart) / bpPerPx - offsetPx + labelW
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
    [genomeRows, displayedGenomes, rowHeight, bpPerPx, offsetPx, displayedRegionStart, labelW],
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
