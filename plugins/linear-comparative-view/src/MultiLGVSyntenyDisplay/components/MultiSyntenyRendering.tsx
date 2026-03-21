import { useCallback, useEffect, useRef, useState } from 'react'

import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { getBpDisplayStr, getContainingView } from '@jbrowse/core/util'
import { parseCigar2 } from '@jbrowse/plugin-alignments'

import { drawCigarOps, getFeatureColor } from './multiSyntenyColorUtils.ts'

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

function renderCanvas(
  ctx: CanvasRenderingContext2D,
  genomeRows: Map<string, MultiPairFeature[]>,
  displayedGenomes: string[],
  opts: {
    width: number
    height: number
    rowHeight: number
    bpPerPx: number
    offsetPx: number
    colorBy: string
    labelW: number
  },
) {
  const { width, height, rowHeight, bpPerPx, offsetPx, colorBy, labelW } = opts
  const showLabels = labelW > 0

  const dpr = window.devicePixelRatio || 1
  ctx.canvas.width = width * dpr
  ctx.canvas.height = height * dpr
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  for (let g = 0; g < displayedGenomes.length; g++) {
    const genomeName = displayedGenomes[g]!
    const y = g * rowHeight
    const features = genomeRows.get(genomeName) ?? []

    if (g % 2 === 0) {
      ctx.fillStyle = '#f8f8f8'
      ctx.fillRect(0, y, width, rowHeight)
    }

    if (showLabels) {
      ctx.fillStyle = '#333'
      ctx.font = `${Math.min(rowHeight - 4, 12)}px sans-serif`
      ctx.textBaseline = 'middle'
      const displayName =
        genomeName.length > 15 ? genomeName.slice(0, 12) + '...' : genomeName
      ctx.fillText(displayName, 4, y + rowHeight / 2)
    }

    const padding = rowHeight >= 6 ? 1 : 0
    for (const feat of features) {
      const x1 = feat.start / bpPerPx - offsetPx + labelW
      const x2 = feat.end / bpPerPx - offsetPx + labelW
      const blockWidth = Math.max(x2 - x1, 1)

      if (x1 + blockWidth < labelW || x1 > width) {
        continue
      }

      const clippedX = Math.max(x1, labelW)
      const clippedW = Math.min(blockWidth, width - clippedX)
      const fy = y + padding
      const fh = rowHeight - padding * 2

      ctx.fillStyle = getFeatureColor(feat, colorBy)
      ctx.fillRect(clippedX, fy, clippedW, fh)

      if (feat.cigar && blockWidth > 2) {
        drawCigarOps(ctx, parseCigar2(feat.cigar), x1, fy, blockWidth, fh, feat.end - feat.start)
      }
    }

    if (rowHeight >= 4) {
      ctx.strokeStyle = '#e0e0e0'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, y + rowHeight)
      ctx.lineTo(width, y + rowHeight)
      ctx.stroke()
    }
  }
}

const MultiSyntenyRendering = observer(function MultiSyntenyRendering({
  model,
}: {
  model: MultiSyntenyModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tooltip, setTooltip] = useState<{
    text: string
    open: boolean
  }>({ text: '', open: false })

  const view = getContainingView(model) as LinearGenomeViewModel
  const { genomeRows, displayedGenomes, rowHeight, colorBy, height } = model
  const { width, bpPerPx, offsetPx } = view
  const labelW = rowHeight >= 12 ? LABEL_WIDTH : 0

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      renderCanvas(ctx, genomeRows, displayedGenomes, {
        width,
        height,
        rowHeight,
        bpPerPx,
        offsetPx,
        colorBy,
        labelW,
      })
    }
  }, [
    genomeRows,
    displayedGenomes,
    width,
    height,
    rowHeight,
    bpPerPx,
    offsetPx,
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
        const x1 = feat.start / bpPerPx - offsetPx + labelW
        const x2 = feat.end / bpPerPx - offsetPx + labelW
        if (mouseX >= x1 && mouseX <= x2) {
          const lines = [
            genomeName,
            `${feat.mateRefName}:${feat.mateStart.toLocaleString()}-${feat.mateEnd.toLocaleString()}`,
            `Size: ${getBpDisplayStr(feat.end - feat.start)}`,
            feat.syriType
              ? `Type: ${feat.syriType}`
              : `Strand: ${feat.strand === -1 ? '-' : '+'}`,
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
    [genomeRows, displayedGenomes, rowHeight, bpPerPx, offsetPx, labelW],
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
