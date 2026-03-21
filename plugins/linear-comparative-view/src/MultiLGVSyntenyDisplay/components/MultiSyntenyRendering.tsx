import { useCallback, useEffect, useRef, useState } from 'react'

import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { getContainingView } from '@jbrowse/core/util'

import type { MultiLGVSyntenyDisplayModel } from '../model.ts'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const LABEL_WIDTH = 120

function getStrandColor(feat: MultiPairFeature) {
  return feat.strand === -1 ? '#f57c00' : '#5677fc'
}

function getSyriColor(feat: MultiPairFeature) {
  switch (feat.syriType) {
    case 'INV':
      return '#FFA500'
    case 'TRANS':
      return '#6495ED'
    case 'DUP':
      return '#00CED1'
    default:
      return '#CCCCCC'
  }
}

function getIdentityColor(feat: MultiPairFeature) {
  if (feat.identity < 0) {
    return '#999'
  }
  const t = feat.identity
  if (t >= 0.95) {
    const f = (t - 0.95) / 0.05
    return `rgb(${Math.round(255 * (1 - f))},${Math.round(200 + 55 * f)},50)`
  }
  if (t >= 0.8) {
    const f = (t - 0.8) / 0.15
    return `rgb(255,${Math.round(200 * f)},0)`
  }
  return 'rgb(200,0,0)'
}

function getFeatureColor(feat: MultiPairFeature, colorBy: string) {
  switch (colorBy) {
    case 'syri':
      return getSyriColor(feat)
    case 'identity':
      return getIdentityColor(feat)
    default:
      return getStrandColor(feat)
  }
}

const LEGENDS: Record<string, [string, string][]> = {
  strand: [
    ['Forward (+)', '#5677fc'],
    ['Reverse (-)', '#f57c00'],
  ],
  syri: [
    ['SYN', '#CCCCCC'],
    ['INV', '#FFA500'],
    ['TRANS', '#6495ED'],
    ['DUP', '#00CED1'],
  ],
  identity: [
    ['>99%', 'rgb(0,255,50)'],
    ['95%', 'rgb(255,200,0)'],
    ['80%', 'rgb(255,0,0)'],
    ['<80%', 'rgb(200,0,0)'],
  ],
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
  model,
}: {
  model: MultiLGVSyntenyDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tooltip, setTooltip] = useState<{
    text: string
    open: boolean
  }>({ text: '', open: false })

  const view = getContainingView(model) as LinearGenomeViewModel
  const { genomeRows, displayedGenomes, rowHeight, colorBy, height } = model
  const { width, bpPerPx, offsetPx } = view

  const showLabels = rowHeight >= 12
  const showSeparators = rowHeight >= 4
  const labelW = showLabels ? LABEL_WIDTH : 0

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

        ctx.fillStyle = getFeatureColor(feat, colorBy)
        ctx.fillRect(
          Math.max(x1, labelW),
          y + padding,
          Math.min(blockWidth, width - Math.max(x1, labelW)),
          rowHeight - padding * 2,
        )
      }

      if (showSeparators) {
        ctx.strokeStyle = '#e0e0e0'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(0, y + rowHeight)
        ctx.lineTo(width, y + rowHeight)
        ctx.stroke()
      }
    }

    if (displayedGenomes.length > 0 && rowHeight >= 8) {
      const legendEntries = LEGENDS[colorBy] ?? LEGENDS.strand!
      const legendY = 4
      let lx = labelW + 4
      ctx.font = '10px sans-serif'
      ctx.textBaseline = 'top'
      for (const [label, color] of legendEntries) {
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
    colorBy,
    showLabels,
    showSeparators,
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
          const size = feat.end - feat.start
          const lines = [
            genomeName,
            `${feat.mateRefName}:${feat.mateStart.toLocaleString()}-${feat.mateEnd.toLocaleString()}`,
            `Size: ${formatBp(size)}`,
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
