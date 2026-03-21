import { useCallback, useEffect, useRef, useState } from 'react'

import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { syriColors } from '../../LinearSyntenyDisplay/drawSyntenyUtils.ts'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

const SYRI_COLOR_MAP: Record<string, string> = {
  SYN: syriColors.SYN,
  INV: syriColors.INV,
  TRANS: syriColors.TRANS,
  DUP: syriColors.DUP,
}

const DEFAULT_COLOR = '#999999'
const LABEL_WIDTH = 120

const SEGMENT_PALETTE = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
]

function hashString(s: string) {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getFeatureColor(
  feat: MultiPairFeature,
  segmentColorMap: Map<string, string> | undefined,
) {
  if (segmentColorMap && feat.segmentId) {
    return segmentColorMap.get(feat.segmentId) ?? DEFAULT_COLOR
  }
  if (feat.syriType) {
    return SYRI_COLOR_MAP[feat.syriType] ?? DEFAULT_COLOR
  }
  if (feat.strand === -1) {
    return '#FFA500'
  }
  return '#CCCCCC'
}

function hitTestFeature(
  mouseX: number,
  mouseY: number,
  genomeRows: Map<string, MultiPairFeature[]>,
  displayedGenomes: string[],
  rowHeight: number,
  bpPerPx: number,
  offsetPx: number,
) {
  const genomeIdx = Math.floor(mouseY / rowHeight)
  if (genomeIdx < 0 || genomeIdx >= displayedGenomes.length) {
    return undefined
  }
  const genomeName = displayedGenomes[genomeIdx]!
  const features = genomeRows.get(genomeName)
  if (!features) {
    return undefined
  }

  for (const feat of features) {
    const x1 = feat.start / bpPerPx - offsetPx + LABEL_WIDTH
    const x2 = feat.end / bpPerPx - offsetPx + LABEL_WIDTH
    if (mouseX >= x1 && mouseX <= x2) {
      return { feat, genomeName }
    }
  }
  return undefined
}

function formatBp(bp: number) {
  if (bp >= 1_000_000) {
    return `${(bp / 1_000_000).toFixed(2)}Mb`
  }
  if (bp >= 1_000) {
    return `${(bp / 1_000).toFixed(1)}kb`
  }
  return `${bp}bp`
}

const MultiSyntenyRendering = observer(function MultiSyntenyRendering({
  genomeRows,
  displayedGenomes,
  width,
  rowHeight,
  bpPerPx,
  offsetPx,
}: {
  genomeRows: Map<string, MultiPairFeature[]>
  displayedGenomes: string[]
  width: number
  rowHeight: number
  bpPerPx: number
  offsetPx: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const height = displayedGenomes.length * rowHeight
  const [tooltipText, setTooltipText] = useState('')
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [tooltipOpen, setTooltipOpen] = useState(false)

  // Build segment color map once
  const segmentColorMap = useRef<Map<string, string> | undefined>(undefined)
  useEffect(() => {
    const allSegmentIds = new Set<string>()
    for (const features of genomeRows.values()) {
      for (const f of features) {
        if (f.segmentId) {
          allSegmentIds.add(f.segmentId)
        }
      }
    }
    if (allSegmentIds.size > 0) {
      const map = new Map<string, string>()
      for (const sid of allSegmentIds) {
        const idx = hashString(sid) % SEGMENT_PALETTE.length
        map.set(sid, SEGMENT_PALETTE[idx]!)
      }
      segmentColorMap.current = map
    } else {
      segmentColorMap.current = undefined
    }
  }, [genomeRows])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const trackLeft = LABEL_WIDTH

    for (let g = 0; g < displayedGenomes.length; g++) {
      const genomeName = displayedGenomes[g]!
      const y = g * rowHeight
      const features = genomeRows.get(genomeName) ?? []

      if (g % 2 === 0) {
        ctx.fillStyle = '#f8f8f8'
        ctx.fillRect(0, y, width, rowHeight)
      }

      ctx.fillStyle = '#333'
      ctx.font = `${Math.min(rowHeight - 4, 12)}px sans-serif`
      ctx.textBaseline = 'middle'
      const displayName =
        genomeName.length > 15 ? genomeName.slice(0, 12) + '...' : genomeName
      ctx.fillText(displayName, 4, y + rowHeight / 2)

      const padding = 2
      for (const feat of features) {
        const x1 = feat.start / bpPerPx - offsetPx + trackLeft
        const x2 = feat.end / bpPerPx - offsetPx + trackLeft
        const blockWidth = Math.max(x2 - x1, 1)

        if (x1 + blockWidth < trackLeft || x1 > width) {
          continue
        }

        ctx.fillStyle = getFeatureColor(feat, segmentColorMap.current)
        ctx.fillRect(
          Math.max(x1, trackLeft),
          y + padding,
          Math.min(blockWidth, width - Math.max(x1, trackLeft)),
          rowHeight - padding * 2,
        )
      }

      ctx.strokeStyle = '#e0e0e0'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, y + rowHeight)
      ctx.lineTo(width, y + rowHeight)
      ctx.stroke()
    }

    // Legend
    if (displayedGenomes.length > 0) {
      const legendY = 4
      const legendX = trackLeft + 4
      ctx.font = '10px sans-serif'
      ctx.textBaseline = 'top'
      let lx = legendX
      for (const [label, color] of Object.entries(SYRI_COLOR_MAP)) {
        ctx.fillStyle = color
        ctx.fillRect(lx, legendY, 10, 10)
        ctx.fillStyle = '#333'
        ctx.fillText(label, lx + 13, legendY)
        lx += ctx.measureText(label).width + 22
      }
    }
  }, [
    genomeRows,
    displayedGenomes,
    width,
    height,
    rowHeight,
    bpPerPx,
    offsetPx,
  ])

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const hit = hitTestFeature(
        mouseX,
        mouseY,
        genomeRows,
        displayedGenomes,
        rowHeight,
        bpPerPx,
        offsetPx,
      )

      if (hit) {
        const { feat, genomeName } = hit
        const size = feat.end - feat.start
        const lines = [
          genomeName,
          `${feat.mateRefName}:${feat.mateStart.toLocaleString()}-${feat.mateEnd.toLocaleString()}`,
          `Size: ${formatBp(size)}`,
          feat.syriType ? `Type: ${feat.syriType}` : `Strand: ${feat.strand === -1 ? '-' : '+'}`,
          feat.identity > 0 ? `Identity: ${(feat.identity * 100).toFixed(1)}%` : '',
          feat.segmentId ? `Segment: ${feat.segmentId}` : '',
        ].filter(Boolean)
        setTooltipText(lines.join('\n'))
        setTooltipPos({ x: e.clientX, y: e.clientY })
        setTooltipOpen(true)
      } else {
        setTooltipOpen(false)
      }
    },
    [genomeRows, displayedGenomes, rowHeight, bpPerPx, offsetPx],
  )

  const onMouseLeave = useCallback(() => {
    setTooltipOpen(false)
  }, [])

  return (
    <Tooltip
      open={tooltipOpen}
      title={
        <span style={{ whiteSpace: 'pre-line', fontSize: 12 }}>
          {tooltipText}
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
          cursor: tooltipOpen ? 'pointer' : 'default',
        }}
      />
    </Tooltip>
  )
})

export default MultiSyntenyRendering
