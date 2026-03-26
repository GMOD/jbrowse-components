import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getBpDisplayStr, getContainingView } from '@jbrowse/core/util'
import { Tooltip } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { MultiSyntenyRenderer } from './MultiSyntenyRenderer.ts'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import { computeMultiSyntenyLabels } from './computeVisibleLabels.ts'
import { buildSyntenyIndex, hitTestMultiSynteny } from './hitTesting.ts'
import { LABEL_WIDTH } from './multiSyntenyBackendTypes.ts'

import type { FeatureHitResult } from './hitTesting.ts'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface MultiSyntenyModel {
  genomeRows: Map<string, MultiPairFeature[]>
  displayedGenomes: string[]
  rowHeight: number
  colorBy: string
  height: number
  showSnps: boolean
  dataVersion: number
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
  labelW: number,
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
  const padding = rowHeight >= 6 ? 1 : 0
  return {
    x: Math.max(px1.offsetPx - view.offsetPx + labelW, labelW),
    x2: Math.min(px2.offsetPx - view.offsetPx + labelW, viewWidth),
    y: sampleIdx * rowHeight + padding,
    h: rowHeight - padding * 2,
  }
}

function FeatureHighlightOverlay({
  hoveredHit,
  selectedHit,
  rowHeight,
  labelW,
  view,
  width,
  height,
}: {
  hoveredHit: FeatureHitResult | undefined
  selectedHit: FeatureHitResult | undefined
  rowHeight: number
  labelW: number
  view: LinearGenomeViewModel
  width: number
  height: number
}) {
  const hoverRect = hoveredHit
    ? featureToRect(
        hoveredHit.feature,
        hoveredHit.sampleIdx,
        rowHeight,
        labelW,
        view,
        width,
      )
    : undefined
  const selectRect = selectedHit
    ? featureToRect(
        selectedHit.feature,
        selectedHit.sampleIdx,
        rowHeight,
        labelW,
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
          y={hoverRect.y}
          width={hoverRect.x2 - hoverRect.x}
          height={hoverRect.h}
          fill="rgba(0,0,0,0.15)"
        />
      ) : null}
      {selectRect ? (
        <rect
          x={selectRect.x}
          y={selectRect.y}
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
  const [hoveredHit, setHoveredHit] = useState<FeatureHitResult | undefined>()
  const [selectedHit, setSelectedHit] = useState<FeatureHitResult | undefined>()
  const prevViewRef = useRef({ bpPerPx: 0, offsetPx: 0 })

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

  // SYNC: GPU upload-before-draw autorun pattern mirrors
  // LinearAlignmentsDisplay (plugins/alignments/src/LinearAlignmentsDisplay/model.ts).
  // Upload is registered BEFORE draw so MobX runs it first when
  // genomeRows changes, ensuring GPU buffers are populated before
  // renderGpu() reads them.
  //
  // DEVIATION: These autoruns live in React useEffect hooks rather than
  // in the model's afterAttach (as LinearAlignmentsDisplay does). This
  // has no practical difference — the autoruns are disposed on unmount
  // either way.
  useEffect(() => {
    if (!ready) {
      return
    }
    return autorun(() => {
      const renderer = rendererRef.current
      if (renderer?.isGpu) {
        const { genomeRows, displayedGenomes, colorBy, showSnps } = model
        renderer.uploadGeometry(genomeRows, displayedGenomes, colorBy, showSnps)
      }
    })
  }, [ready, model, view])

  // GPU draw autorun: re-renders on view changes (scroll, zoom, resize)
  // or new data. dataVersion is bumped by MultiRegionDisplayMixin when
  // setLoadedRegionForRegion is called — same mechanism as the
  // LinearAlignmentsDisplay:draw autorun tracking self.dataVersion.
  useEffect(() => {
    if (!ready) {
      return
    }
    return autorun(() => {
      const renderer = rendererRef.current
      if (renderer?.isGpu) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _dv = model.dataVersion
        const { height, rowHeight } = model
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
          showSnps,
        } = model
        const { width, offsetPx } = view
        const labelW = rowHeight >= 12 ? LABEL_WIDTH : 0
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
  const { genomeRows, displayedGenomes, rowHeight, height, showSnps } = model
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
      return hitTestMultiSynteny(
        e.clientX - rect.left,
        e.clientY - rect.top,
        rowHeight,
        labelW,
        view,
        spatialIndex,
      )
    },
    [rowHeight, labelW, view, spatialIndex],
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const hit = doHitTest(e)
      setHoveredHit(hit)
      if (hit) {
        setTooltip({ text: formatTooltip(hit), open: true })
      } else {
        setTooltip(t => (t.open ? { text: '', open: false } : t))
      }
    },
    [doHitTest],
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
        labelW,
        showSnps,
        view.bpToPx.bind(view),
        offsetPx,
        width,
      ),
    [
      genomeRows,
      displayedGenomes,
      rowHeight,
      labelW,
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
        <VisibleLabelsOverlay labels={labels} width={width} height={height} />
        <FeatureHighlightOverlay
          hoveredHit={hoveredHit}
          selectedHit={selectedHit}
          rowHeight={rowHeight}
          labelW={labelW}
          view={view}
          width={width}
          height={height}
        />
      </div>
    </Tooltip>
  )
})

export default MultiSyntenyRendering
