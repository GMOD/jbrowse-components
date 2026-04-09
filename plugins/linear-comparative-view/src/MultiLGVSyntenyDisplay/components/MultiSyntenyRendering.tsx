import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  MISMATCH_COLOR,
  buildCoverageTooltipBin,
} from '@jbrowse/alignments-core'
import { ErrorOverlay } from '@jbrowse/core/ui'
import {
  getBpDisplayStr,
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
  useGpuRenderer,
  useTabVisibilityRerender,
} from '@jbrowse/core/util'
import { hexToGLrgb } from '@jbrowse/core/util/colord'
import {
  CoverageTooltipContents,
  CoverageYScaleBar,
} from '@jbrowse/plugin-alignments'
import { Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { MultiSyntenyRenderer } from './MultiSyntenyRenderer.ts'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import { computeMultiSyntenyLabels } from './computeVisibleLabels.ts'
import { buildSyntenyIndex, hitTestMultiSynteny } from './hitTesting.ts'
import {
  LABEL_FONT_MAX,
  LABEL_WIDTH,
  truncateGenomeName,
} from './multiSyntenyBackendTypes.ts'

import type { MultiLGVSyntenyDisplayModel } from '../model.ts'
import type { FeatureHitResult } from './hitTesting.ts'
import type { CoverageTooltipBin } from '@jbrowse/alignments-core'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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

function pct(n: number, total: number) {
  return `${((n / (total || 1)) * 100).toFixed(1)}%`
}

function openCoverageWidget(
  model: IAnyStateTreeNode,
  bin: CoverageTooltipBin,
  refName: string,
) {
  const session = getSession(model)
  if (isSessionModelWithWidgets(session)) {
    const featureData: Record<string, unknown> = {
      uniqueId: `coverage-${refName}-${bin.position}`,
      name: 'Coverage',
      type: 'coverage',
      refName,
      start: bin.position,
      end: bin.position + 1,
      depth: bin.depth,
    }
    for (const [base, snpEntry] of Object.entries(bin.snps)) {
      featureData[`SNP ${base.toUpperCase()}`] =
        `${snpEntry.count}/${bin.depth} (${pct(snpEntry.count, bin.depth)}) (${snpEntry.fwd}(+) ${snpEntry.rev}(-))`
    }
    for (const [type, interbaseEntry] of Object.entries(bin.interbase)) {
      featureData[type] =
        `${interbaseEntry.count}/${bin.interbaseDepth} (${pct(interbaseEntry.count, bin.interbaseDepth)}) (${interbaseEntry.minLen}-${interbaseEntry.maxLen}bp)`
    }
    const featureWidget = session.addWidget(
      'BaseFeatureWidget',
      'baseFeature',
      {
        featureData,
        view: getContainingView(model),
        track: getContainingTrack(model),
      },
    )
    session.showWidget(featureWidget)
  }
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
          {truncateGenomeName(name)}
        </div>
      ))}
    </div>
  )
}

const MultiSyntenyRendering = observer(function MultiSyntenyRendering({
  model,
}: {
  model: MultiLGVSyntenyDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { palette } = useTheme()
  const [tooltip, setTooltip] = useState<{
    content: React.ReactNode
    open: boolean
  }>({ content: '', open: false })
  const [hoveredHit, setHoveredHit] = useState<FeatureHitResult | undefined>()
  const [selectedHit, setSelectedHit] = useState<FeatureHitResult | undefined>()
  const prevViewRef = useRef({ bpPerPx: 0, offsetPx: 0 })

  const view = getContainingView(model) as LinearGenomeViewModel

  // Renderer lifecycle: create, init, store in model
  const gpuOpts = useMemo(
    () => ({
      onReady: (renderer) => {
        console.log('[MultiSyntenyRendering] onReady, setting webglRenderer')
        model.setWebGLRenderer(renderer)
      },
      onDispose: () => {
        console.log('[MultiSyntenyRendering] onDispose, clearing webglRenderer')
        model.setWebGLRenderer(null)
      },
    }),
    [model],
  )
  const { error, retry } = useGpuRenderer(
    canvasRef,
    MultiSyntenyRenderer,
    gpuOpts,
  )

  useTabVisibilityRerender(() => {
    model.bumpTabVisibility()
  })

  // Theme color palette sync to model
  useEffect(() => {
    model.setColorPalette({
      coverageColorRgb: hexToGLrgb(palette.coverage),
      coverageColorHex: palette.coverage,
      baseColorGl: {
        A: hexToGLrgb(palette.bases.A.main),
        C: hexToGLrgb(palette.bases.C.main),
        G: hexToGLrgb(palette.bases.G.main),
        T: hexToGLrgb(palette.bases.T.main),
      },
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
  const {
    genomeRows,
    displayedGenomes,
    rowHeight,
    rowSpacing,
    height,
    syntenyCoverageHeight,
    showSnps,
    coverageTicks,
  } = model
  const { width, bpPerPx, offsetPx } = view
  const labelW = rowHeight >= 12 ? LABEL_WIDTH : 0

  // Hide tooltip and hover on zoom or scroll changes
  useEffect(() => {
    const prev = prevViewRef.current
    if (
      prev.bpPerPx !== 0 &&
      (prev.bpPerPx !== bpPerPx || prev.offsetPx !== offsetPx)
    ) {
      setTooltip(t => (t.open ? { content: '', open: false } : t))
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
      if (bp.oob) {
        return undefined
      }
      const data = model.rpcDataMap.get(bp.index)
      if (data) {
        const bin = buildCoverageTooltipBin(
          Math.floor(bp.coord - 1),
          data,
          data,
        )
        if (bin) {
          return { bin, refName: bp.refName }
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
        setTooltip({
          content: (
            <span style={{ whiteSpace: 'pre-line', fontSize: 12 }}>
              {formatTooltip(hit)}
            </span>
          ),
          open: true,
        })
      } else {
        const covHit = doCoverageHitTest(e)
        if (covHit) {
          setTooltip({
            content: (
              <CoverageTooltipContents
                bin={covHit.bin}
                refName={covHit.refName}
              />
            ),
            open: true,
          })
        } else {
          setTooltip(t => (t.open ? { content: '', open: false } : t))
        }
      }
    },
    [doHitTest, doCoverageHitTest],
  )

  const onMouseLeave = useCallback(() => {
    setHoveredHit(undefined)
    setTooltip({ content: '', open: false })
  }, [])

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const hit = doHitTest(e)
      if (hit) {
        setSelectedHit(prev =>
          hit.feature.featureId === prev?.feature.featureId ? undefined : hit,
        )
      } else {
        const covHit = doCoverageHitTest(e)
        if (covHit) {
          openCoverageWidget(model, covHit.bin, covHit.refName)
        }
      }
    },
    [doHitTest, doCoverageHitTest, model],
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

  if (error) {
    return (
      <ErrorOverlay
        error={error}
        width={width}
        height={height}
        onRetry={() => {
          retry()
        }}
      />
    )
  }

  return (
    <Tooltip
      open={tooltip.open}
      title={tooltip.content}
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
          data-testid={
            model.canvasDrawn
              ? 'multi_synteny_canvas_done'
              : 'multi_synteny_canvas'
          }
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
        <VisibleLabelsOverlay
          labels={labels}
          width={width}
          height={height}
          yOffset={syntenyCoverageHeight}
        />
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
