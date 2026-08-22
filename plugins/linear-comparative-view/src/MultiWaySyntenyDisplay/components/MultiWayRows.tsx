import { readConfObject } from '@jbrowse/core/configuration'
import {
  doesIntersect2,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import {
  groupSpanOnRow,
  mergedExonIntervals,
  rowFrameX,
} from '../layoutMultiWay.ts'

import type { MultiWayGroup, RowFrame } from '../layoutMultiWay.ts'
import type { MultiWaySyntenyDisplayModel } from '../model.ts'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type Span = readonly [number, number]

const LABEL_HEIGHT = 12

function ribbonPath(s1: Span, y1: number, s2: Span, y2: number) {
  const ym = (y1 + y2) / 2
  return `M ${s1[0]} ${y1} C ${s1[0]} ${ym}, ${s2[0]} ${ym}, ${s2[0]} ${y2} L ${s2[1]} ${y2} C ${s2[1]} ${ym}, ${s1[1]} ${ym}, ${s1[1]} ${y1} Z`
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US')
}

// One gene drawn as its merged exon boxes on an intron midline, in whatever px
// frame `xOf` maps this lane's coordinates through
function GeneGlyph({
  feature,
  xOf,
  y,
  glyphHeight,
  color,
  onClick,
}: {
  feature: Feature
  xOf: (bp: number) => number | undefined
  y: number
  glyphHeight: number
  color: string
  onClick: () => void
}) {
  const l = xOf(feature.get('start'))
  const r = xOf(feature.get('end'))
  if (l === undefined || r === undefined) {
    return null
  }
  const [left, right] = l < r ? [l, r] : [r, l]
  const mid = y + glyphHeight / 2
  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={() => {
        onClick()
      }}
    >
      <line x1={left} x2={right} y1={mid} y2={mid} stroke={color} />
      {mergedExonIntervals(feature).map(([start, end]) => {
        const a = xOf(start)
        const b = xOf(end)
        if (a === undefined || b === undefined) {
          return null
        }
        const [x1, x2] = a < b ? [a, b] : [b, a]
        return (
          <rect
            key={`${start}-${end}`}
            x={x1}
            y={y}
            width={Math.max(1, x2 - x1)}
            height={glyphHeight}
            fill={color}
          />
        )
      })}
      <title>{feature.get('name') ?? feature.get('id')}</title>
    </g>
  )
}

const MultiWayRows = observer(function MultiWayRows({
  model,
  exportSVG,
}: {
  model: MultiWaySyntenyDisplayModel
  exportSVG?: boolean
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const { assemblyManager } = getSession(model)
  const {
    anchorAssemblyName,
    rowAssemblies,
    rowFrames,
    visibleGroups,
    laneGenes,
    height,
    ribbonColor,
    selectedFeatureId,
  } = model
  const assembly = assemblyManager.get(anchorAssemblyName)
  if (!assembly) {
    return null
  }
  const width = model.canvasWidth

  const anchorX = (refName: string, bp: number) => {
    const px = view.bpToPx({
      refName: assembly.getCanonicalRefName2(refName),
      coord: bp,
    })?.offsetPx
    return px === undefined ? undefined : px - view.offsetPx
  }

  const anchorSpans = new Map<string, Span>()
  for (const group of visibleGroups) {
    const a = anchorX(group.anchor.refName, group.anchor.start)
    const b = anchorX(group.anchor.refName, group.anchor.end)
    if (a !== undefined && b !== undefined) {
      anchorSpans.set(group.key, a < b ? [a, b] : [b, a])
    }
  }

  const rowCount = rowAssemblies.length + 1
  const glyphHeight = Math.max(
    5,
    Math.min(18, height / rowCount - LABEL_HEIGHT - 6),
  )
  const usable = height - LABEL_HEIGHT - glyphHeight - 4
  const glyphTop = (rowIndex: number) =>
    LABEL_HEIGHT + (rowCount === 1 ? 0 : (rowIndex * usable) / (rowCount - 1))

  const frameOf = (rowIndex: number): RowFrame | undefined =>
    rowIndex === 0 ? undefined : rowFrames.get(rowAssemblies[rowIndex - 1]!)

  const spanOnRow = (group: MultiWayGroup, rowIndex: number) => {
    if (rowIndex === 0) {
      return anchorSpans.get(group.key)
    }
    const frame = frameOf(rowIndex)
    return frame
      ? groupSpanOnRow(group, rowAssemblies[rowIndex - 1]!, frame, width)
      : undefined
  }

  const ribbons: React.ReactNode[] = []
  for (let rowIndex = 0; rowIndex < rowCount - 1; rowIndex++) {
    for (const group of visibleGroups) {
      const s1 = spanOnRow(group, rowIndex)
      const s2 = spanOnRow(group, rowIndex + 1)
      if (s1 && s2) {
        ribbons.push(
          <path
            key={`ribbon-${rowIndex}-${group.key}`}
            d={ribbonPath(
              s1,
              glyphTop(rowIndex) + glyphHeight,
              s2,
              glyphTop(rowIndex + 1),
            )}
            fill={ribbonColor}
          />,
        )
      }
    }
  }

  const lanes: React.ReactNode[] = []
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const assemblyName =
      rowIndex === 0 ? anchorAssemblyName : rowAssemblies[rowIndex - 1]!
    const frame = frameOf(rowIndex)
    const y = glyphTop(rowIndex)
    const mid = y + glyphHeight / 2

    lanes.push(
      <line
        key={`baseline-${assemblyName}`}
        x1={0}
        x2={width}
        y1={mid}
        y2={mid}
        stroke="rgba(0,0,0,0.08)"
      />,
    )

    const label =
      rowIndex === 0
        ? assemblyName
        : frame
          ? `${assemblyName}  ${frame.refName}:${fmt(frame.min)}..${fmt(frame.max)}${frame.flipped ? ' [rev]' : ''}`
          : assemblyName
    lanes.push(
      <text
        key={`label-${assemblyName}`}
        x={2}
        y={y - 3}
        fontSize={10}
        fill="#333"
      >
        {label}
      </text>,
    )

    const genes = laneGenes?.get(assemblyName)
    const xOf =
      rowIndex === 0
        ? undefined
        : frame
          ? (bp: number) => rowFrameX(frame, bp, width)
          : undefined
    if (genes && (rowIndex === 0 || (frame && xOf))) {
      for (const gene of genes) {
        const inFrame =
          rowIndex === 0 ||
          (gene.get('refName') === frame!.refName &&
            doesIntersect2(
              frame!.min,
              frame!.max,
              gene.get('start'),
              gene.get('end'),
            ))
        if (inFrame) {
          lanes.push(
            <GeneGlyph
              key={`gene-${assemblyName}-${gene.id()}`}
              feature={gene}
              xOf={
                rowIndex === 0 ? bp => anchorX(gene.get('refName'), bp) : xOf!
              }
              y={y}
              glyphHeight={glyphHeight}
              color={
                selectedFeatureId === gene.id()
                  ? 'red'
                  : readConfObject(model.configuration, 'color', {
                      feature: gene,
                    })
              }
              onClick={() => {
                model.selectFeature(gene)
              }}
            />,
          )
        }
      }
    } else {
      // a lane with no gene track still draws its ortholog placements as boxes
      for (const group of visibleGroups) {
        const span = spanOnRow(group, rowIndex)
        if (span) {
          lanes.push(
            <rect
              key={`glyph-${rowIndex}-${group.key}`}
              x={span[0]}
              y={y}
              width={Math.max(1, span[1] - span[0])}
              height={glyphHeight}
              fill={
                selectedFeatureId === group.feature.id()
                  ? 'red'
                  : readConfObject(model.configuration, 'color', {
                      feature: group.feature,
                    })
              }
              style={{ cursor: 'pointer' }}
              onClick={() => {
                model.selectFeature(group.feature)
              }}
            >
              <title>{group.name}</title>
            </rect>,
          )
        }
      }
    }
  }

  const body = (
    <>
      {ribbons}
      {lanes}
    </>
  )
  return exportSVG ? (
    body
  ) : (
    <svg
      width={width}
      height={height}
      data-lanes-current={model.laneGenesCurrent}
    >
      {body}
    </svg>
  )
})

export default MultiWayRows
