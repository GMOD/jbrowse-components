import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { MISMATCH_COLOR } from '@jbrowse/alignments-core'
import { getBpDisplayStr, getContainingView, useGpuRenderer } from '@jbrowse/core/util'
import { CoverageYScaleBar } from '@jbrowse/plugin-alignments'
import { Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { MultiSyntenyRenderer } from './MultiSyntenyRenderer.ts'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import { computeMultiSyntenyLabels } from './computeVisibleLabels.ts'
import { buildSyntenyIndex, hitTestMultiSynteny } from './hitTesting.ts'
import { LABEL_FONT_MAX, LABEL_WIDTH } from './multiSyntenyBackendTypes.ts'

import type { SyntenyRegionData } from '../../LinearSyntenyRPC/syntenyRegionTypes.ts'
import type { SyntenyColorPalette } from '../model.ts'
import type { CoverageTicks } from '@jbrowse/alignments-core'
import type { FeatureHitResult } from './hitTesting.ts'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface MultiSyntenyModel {
  genomeRows: Map<string, MultiPairFeature[]>
  rpcDataMap: Map<string, SyntenyRegionData>
  displayedGenomes: string[]
  rowHeight: number
  rowSpacing: boolean
  colorBy: string
  height: number
  syntenyAreaHeight: number
  syntenyCoverageHeight: number
  showCoverage: boolean
  showSnps: boolean
  dataVersion: number
  coverageMaxDepth: number
  coverageTicks: CoverageTicks | undefined
  setWebGLRenderer: (renderer: MultiSyntenyRenderer | null) => void
  setColorPalette: (palette: SyntenyColorPalette | null) => void
}

function formatTooltip(hit: FeatureHitResult) {
  const { feature: feat, genomeName, cigarItem } = hit
  const refSize = feat.end - feat.start
  const querySize = feat.mateEnd - feat.mateStart
  const lines = [
    genomeName,
    `Ref: ${feat.origRefName}:${feat.start.toLocaleString()}-${feat.end.toLocaleString()} (${getBpDisplayStr(refSize)})`,
    `Query: ${feat.mateRefName}:${feat.mateStart.toLocaleString()}-${feat.mateEnd.toLocaleString()} (${getBpDisplayStr(querySize)})`,
    feat.strand === -1 ? 'Inverted' : '',
    feat.syriType ? `Type: ${feat.syriType}` : '',
    feat.identity > 0 ? `Identity: ${(feat.identity * 100).toFixed(1)}%` : '',
    feat.segmentId ? `Segment: ${feat.segmentId}` : '',
  ]

  if (cigarItem) {
    lines.push('')
    switch (cigarItem.type) {
      case 'mismatch':
        lines.push(
          cigarItem.base
            ? `SNP: ${cigarItem.base} at ${cigarItem.refPosition.toLocaleString()}`
            : `Mismatch: ${cigarItem.length}bp at ${cigarItem.refPosition.toLocaleString()}`,
        )
        break
      case 'insertion':
        lines.push(
          `Insertion: ${cigarItem.length}bp at ${cigarItem.refPosition.toLocaleString()}`,
        )
        if (cigarItem.insertionSeq) {
          const seq =
            cigarItem.insertionSeq.length > 20
              ? `${cigarItem.insertionSeq.slice(0, 20)}...`
              : cigarItem.insertionSeq
          lines.push(`Seq: ${seq}`)
        }
        break
      case 'deletion':
        lines.push(
          `Deletion: ${cigarItem.length}bp at ${cigarItem.refPosition.toLocaleString()}`,
        )
        break
    }
  }

  return lines.filter(Boolean).join('\n')
}

function featureToRect(
  feature: MultiPairFeature,
  sampleIdx: number,
  rowHeight: number,
  rowSpacing: boolean,
  view: LinearGenomeViewModel,
  viewWidth: number,
) {
  const px1 = view.bpToPx({
    refName: feature.origRefName,
    coord: feature.start,
  })
  const px2 = view.bpToPx({ refName: feature.origRefName, coord: feature.end })
  if (!px1 || !px2) {
    return undefined
  }
  const padding = rowSpacing ? 1 : 0
  return {
    x: Math.max(px1.offsetPx - view.offsetPx, 0),
    x2: Math.min(px2.offsetPx - view.offsetPx, viewWidth),
    y: sampleIdx * rowHeight + padding,
    h: rowHeight - padding * 2,
  }
}

function FeatureHighlightOverlay({
  hoveredHit,
  selectedHit,
  rowHeight,
  rowSpacing,
  view,
  width,
  height,
  yOffset = 0,
}: {
  hoveredHit: FeatureHitResult | undefined
  selectedHit: FeatureHitResult | undefined
  rowHeight: number
  rowSpacing: boolean
  view: LinearGenomeViewModel
  width: number
  height: number
  yOffset?: number
}) {
  const hoverRect = hoveredHit
    ? featureToRect(
        hoveredHit.feature,
        hoveredHit.sampleIdx,
        rowHeight,
        rowSpacing,
        view,
        width,
      )
    : undefined
  const selectRect = selectedHit
    ? featureToRect(
        selectedHit.feature,
        selectedHit.sampleIdx,
        rowHeight,
        rowSpacing,
        view,
        width,
      )
    : undefined

  if (!hoverRect && !selectRect) {
    return null
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {hoverRect ? (
        <rect
          x={hoverRect.x}
          y={hoverRect.y + yOffset}
          width={hoverRect.x2 - hoverRect.x}
          height={hoverRect.h}
          fill="rgba(0,0,0,0.15)"
        />
      ) : null}
      {selectRect ? (
        <rect
          x={selectRect.x}
          y={selectRect.y + yOffset}
          width={selectRect.x2 - selectRect.x}
          height={selectRect.h}
          fill="none"
          stroke="rgba(0,0,0,0.8)"
          strokeWidth={2}
        />
      ) : null}
    </svg>
  )
}

function GenomeNameOverlay({
  displayedGenomes,
  rowHeight,
  labelW,
  height,
  yOffset = 0,
}: {
  displayedGenomes: string[]
  rowHeight: number
  labelW: number
  height: number
  yOffset?: number
}) {
  if (labelW === 0) {
    return null
  }
  const fontSize = Math.min(rowHeight - 4, LABEL_FONT_MAX)
  if (fontSize < 4) {
    return null
  }
  return (
    <div
      style={{
        position: 'absolute',
        top: yOffset,
        left: 0,
        width: labelW,
        height,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {displayedGenomes.map((name, i) => (
        <div
          key={name}
          style={{
            position: 'absolute',
            top: i * rowHeight,
            left: 0,
            width: labelW,
            height: rowHeight,
            background: i % 2 === 0 ? '#f8f8f8' : '#ededed',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 4,
            fontSize,
            fontFamily: 'sans-serif',
            color: '#333',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box',
          }}
        >
          {name.length > 15 ? `${name.slice(0, 12)}...` : name}
        </div>
      ))}
    </div>
  )
}

const MultiSyntenyRendering = observer(function MultiSyntenyRendering({
  model,
}: {
  model: MultiSyntenyModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { palette } = useTheme()
  const [tooltip, setTooltip] = useState<{
    text: string
    open: boolean
  }>({ text: '', open: false })
  const [hoveredHit, setHoveredHit] = useState<FeatureHitResult | undefined>()
  const [selectedHit, setSelectedHit] = useState<FeatureHitResult | undefined>()
  const prevViewRef = useRef({ bpPerPx: 0, offsetPx: 0 })

  const view = getContainingView(model) as LinearGenomeViewModel

  // Renderer lifecycle: create, init, store in model
  const gpuOpts = useMemo(
    () => ({
      onReady: (renderer: MultiSyntenyRenderer) => {
        model.setWebGLRenderer(renderer)
      },
      onDispose: () => {
        model.setWebGLRenderer(null)
      },
    }),
    [model],
  )
  useGpuRenderer(canvasRef, MultiSyntenyRenderer, gpuOpts)

  // Theme color palette sync to model
  useEffect(() => {
    const hex =
      palette.mode === 'dark' ? palette.grey[700] : palette.grey[400]
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    model.setColorPalette({
      coverageColorRgb: [r, g, b],
      syntenyColors: {
        mismatch: MISMATCH_COLOR,
        deletion: palette.deletion,
        insertion: palette.insertion,
        baseA: palette.bases.A.main,
        baseC: palette.bases.C.main,
        baseG: palette.bases.G.main,
        baseT: palette.bases.T.main,
      },
    })
  }, [model, palette])

  // Read observables during render for tooltip/style (observer tracks these)
  const { genomeRows, displayedGenomes, rowHeight, rowSpacing, height, syntenyCoverageHeight, showSnps, coverageTicks } = model
  const { width, bpPerPx, offsetPx } = view
  const labelW = rowHeight >= 12 ? LABEL_WIDTH : 0

  // Hide tooltip and hover on zoom or scroll changes
  useEffect(() => {
    const prev = prevViewRef.current
    if (
      prev.bpPerPx !== 0 &&
      (prev.bpPerPx !== bpPerPx || prev.offsetPx !== offsetPx)
    ) {
      setTooltip(t => (t.open ? { text: '', open: false } : t))
      setHoveredHit(undefined)
    }
    prevViewRef.current = { bpPerPx, offsetPx }
  }, [bpPerPx, offsetPx])

  const spatialIndex = useMemo(
    () => buildSyntenyIndex(genomeRows, displayedGenomes, showSnps),
    [genomeRows, displayedGenomes, showSnps],
  )

  // Clear stale selection when data changes
  useEffect(() => {
    setSelectedHit(undefined)
  }, [genomeRows, displayedGenomes])

  const doHitTest = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top - syntenyCoverageHeight
      if (y < 0) {
        return undefined
      }
      return hitTestMultiSynteny(
        e.clientX - rect.left,
        y,
        rowHeight,
        labelW,
        view,
        spatialIndex,
      )
    },
    [rowHeight, labelW, view, spatialIndex, syntenyCoverageHeight],
  )

  const doCoverageHitTest = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!model.coverageMaxDepth || syntenyCoverageHeight === 0) {
        return undefined
      }
      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top
      if (y < 0 || y >= syntenyCoverageHeight) {
        return undefined
      }
      const x = e.clientX - rect.left
      const bp = view.pxToBp(x + view.offsetPx)
      if (!bp || bp.oob) {
        return undefined
      }
      const regionKey = `${bp.assemblyName}:${bp.refName}:${bp.start}:${bp.end}${bp.reversed ? ':rev' : ''}`
      const data = model.rpcDataMap.get(regionKey)
      if (data) {
        const idx = Math.floor(bp.coord - 1) - data.regionStart - data.coverageStartOffset
        if (idx >= 0 && idx < data.coverageDepths.length) {
          const depth = data.coverageDepths[idx]!
          if (depth > 0) {
            return `${bp.refName}:${Math.floor(bp.coord).toLocaleString()} depth: ${depth}`
          }
        }
      }
      return undefined
    },
    [model.coverageMaxDepth, model.rpcDataMap, syntenyCoverageHeight, view],
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const hit = doHitTest(e)
      setHoveredHit(hit)
      if (hit) {
        setTooltip({ text: formatTooltip(hit), open: true })
      } else {
        const covTip = doCoverageHitTest(e)
        if (covTip) {
          setTooltip({ text: covTip, open: true })
        } else {
          setTooltip(t => (t.open ? { text: '', open: false } : t))
        }
      }
    },
    [doHitTest, doCoverageHitTest],
  )

  const onMouseLeave = useCallback(() => {
    setHoveredHit(undefined)
    setTooltip({ text: '', open: false })
  }, [])

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const hit = doHitTest(e)
      setSelectedHit(prev =>
        hit?.feature.featureId === prev?.feature.featureId ? undefined : hit,
      )
    },
    [doHitTest],
  )

  const labels = useMemo(
    () =>
      computeMultiSyntenyLabels(
        genomeRows,
        displayedGenomes,
        rowHeight,
        rowSpacing,
        showSnps,
        view.bpToPx.bind(view),
        offsetPx,
        width,
      ),
    [
      genomeRows,
      displayedGenomes,
      rowHeight,
      rowSpacing,
      showSnps,
      view,
      offsetPx,
      width,
    ],
  )

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
      <div
        style={{ position: 'relative', width, height }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        <canvas
          data-testid="multi_synteny_canvas"
          ref={canvasRef}
          style={{
            width,
            height,
            display: 'block',
            cursor: tooltip.open ? 'pointer' : 'default',
          }}
        />
        {coverageTicks ? (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 50,
              height: syntenyCoverageHeight,
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            <CoverageYScaleBar model={{ coverageTicks }} />
          </svg>
        ) : null}
        <GenomeNameOverlay
          displayedGenomes={displayedGenomes}
          rowHeight={rowHeight}
          labelW={labelW}
          height={height - syntenyCoverageHeight}
          yOffset={syntenyCoverageHeight}
        />
        <VisibleLabelsOverlay labels={labels} width={width} height={height} yOffset={syntenyCoverageHeight} />
        <FeatureHighlightOverlay
          hoveredHit={hoveredHit}
          selectedHit={selectedHit}
          rowHeight={rowHeight}
          rowSpacing={rowSpacing}
          view={view}
          width={width}
          height={height}
          yOffset={syntenyCoverageHeight}
        />
      </div>
    </Tooltip>
  )
})

export default MultiSyntenyRendering
