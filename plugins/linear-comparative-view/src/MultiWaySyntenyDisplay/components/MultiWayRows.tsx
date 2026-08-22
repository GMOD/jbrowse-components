import { readConfObject } from '@jbrowse/core/configuration'
import {
  doesIntersect2,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { geneGlyphShape, groupSpanOnRow, rowFrameX } from '../layoutMultiWay.ts'

import type { MultiWayGroup, RowFrame } from '../layoutMultiWay.ts'
import type { MultiWaySyntenyDisplayModel } from '../model.ts'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type Span = readonly [number, number]

const LABEL_HEIGHT = 12

// ribbons narrower than this on both ends are clutter at alignment-record
// density; the blocks they connect are still drawn in the lanes
const MIN_RIBBON_PX = 2

// what a hovered ortholog group's ribbons fill with, so one hover reads the
// group down every lane it reaches
const RIBBON_HIGHLIGHT = 'rgba(70,70,70,0.55)'

function ribbonPath(s1: Span, y1: number, s2: Span, y2: number) {
  const ym = (y1 + y2) / 2
  return `M ${s1[0]} ${y1} C ${s1[0]} ${ym}, ${s2[0]} ${ym}, ${s2[0]} ${y2} L ${s2[1]} ${y2} C ${s2[1]} ${ym}, ${s1[1]} ${ym}, ${s1[1]} ${y1} Z`
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US')
}

// Gene glyph geometry matching the canvas gene track's: UTRs thinner and
// vertically centered, intron lines carrying direction chevrons, an arrowhead
// past the downstream end. Stroke matches the lane labels.
const UTR_HEIGHT_FRACTION = 0.65
const CHEVRON_SPACING_PX = 10
const MIN_CHEVRON_GAP_PX = 8
const MIN_ARROW_GLYPH_PX = 4
const GENE_STROKE = '#333'

function chevronAt(x: number, mid: number, size: number, dir: number) {
  return `M ${x - size * dir} ${mid - size} L ${x} ${mid} L ${x - size * dir} ${mid + size}`
}

// One gene drawn as its merged CDS/UTR boxes on an intron midline, in whatever
// px frame `xOf` maps this lane's coordinates through. Direction is resolved
// in pixel space, so a gene on a flipped lane points the way it reads there.
function GeneGlyph({
  feature,
  xOf,
  y,
  glyphHeight,
  color,
  utrColor,
  onClick,
}: {
  feature: Feature
  xOf: (bp: number) => number | undefined
  y: number
  glyphHeight: number
  color: string
  utrColor: string
  onClick: () => void
}) {
  const l = xOf(feature.get('start'))
  const r = xOf(feature.get('end'))
  if (l === undefined || r === undefined) {
    return null
  }
  const strand = feature.get('strand') ?? 0
  const pxDir = strand === 0 ? 0 : l <= r ? strand : -strand
  const [left, right] = l < r ? [l, r] : [r, l]
  const mid = y + glyphHeight / 2
  const { full, thin } = geneGlyphShape(feature)

  const toPx = (start: number, end: number): Span | undefined => {
    const a = xOf(start)
    const b = xOf(end)
    return a === undefined || b === undefined
      ? undefined
      : a < b
        ? [a, b]
        : [b, a]
  }
  const fullPx = full.flatMap(([s, e]) => {
    const px = toPx(s, e)
    return px ? [px] : []
  })
  const thinPx = thin.flatMap(([s, e]) => {
    const px = toPx(s, e)
    return px ? [px] : []
  })

  const blocks = [...fullPx, ...thinPx].sort((a, b) => a[0] - b[0])
  const chevronSize = Math.min(2.5, glyphHeight / 3)
  let chevrons = ''
  if (pxDir !== 0) {
    let prevEnd = left
    for (const [blockStart, blockEnd] of blocks) {
      if (blockStart - prevEnd >= MIN_CHEVRON_GAP_PX) {
        for (
          let x = prevEnd + CHEVRON_SPACING_PX / 2;
          x <= blockStart - CHEVRON_SPACING_PX / 2;
          x += CHEVRON_SPACING_PX
        ) {
          chevrons += chevronAt(x, mid, chevronSize, pxDir)
        }
      }
      prevEnd = Math.max(prevEnd, blockEnd)
    }
  }

  const arrowSize = Math.min(3.5, glyphHeight / 2)
  const arrow =
    pxDir !== 0 && right - left >= MIN_ARROW_GLYPH_PX
      ? chevronAt(
          (pxDir === 1 ? right : left) + arrowSize * pxDir,
          mid,
          arrowSize,
          pxDir,
        )
      : ''

  const utrY = y + ((1 - UTR_HEIGHT_FRACTION) / 2) * glyphHeight
  const utrHeight = glyphHeight * UTR_HEIGHT_FRACTION
  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={() => {
        onClick()
      }}
    >
      <line x1={left} x2={right} y1={mid} y2={mid} stroke={GENE_STROKE} />
      {chevrons ? <path d={chevrons} stroke={GENE_STROKE} fill="none" /> : null}
      {thinPx.map(([x1, x2]) => (
        <rect
          key={`utr-${x1}-${x2}`}
          x={x1}
          y={utrY}
          width={Math.max(1, x2 - x1)}
          height={utrHeight}
          fill={utrColor}
        />
      ))}
      {fullPx.map(([x1, x2]) => (
        <rect
          key={`cds-${x1}-${x2}`}
          x={x1}
          y={y}
          width={Math.max(1, x2 - x1)}
          height={glyphHeight}
          fill={color}
        />
      ))}
      {arrow ? <path d={arrow} stroke={GENE_STROKE} fill="none" /> : null}
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
    laneLinks,
    height,
    ribbonColor,
    selectedFeatureId,
    hoveredGroupKey,
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
      if (s1 && s2 && Math.max(s1[1] - s1[0], s2[1] - s2[0]) >= MIN_RIBBON_PX) {
        ribbons.push(
          <path
            key={`ribbon-${rowIndex}-${group.key}`}
            d={ribbonPath(
              s1,
              glyphTop(rowIndex) + glyphHeight,
              s2,
              glyphTop(rowIndex + 1),
            )}
            fill={
              hoveredGroupKey === group.key ? RIBBON_HIGHLIGHT : ribbonColor
            }
            onMouseEnter={() => {
              model.setHoveredGroupKey(group.key)
            }}
            onMouseLeave={() => {
              model.setHoveredGroupKey(undefined)
            }}
          >
            <title>{group.name}</title>
          </path>,
        )
      }
    }
  }

  // alignment-level sources also carry the direct records between adjacent
  // mate lanes (the per-pair fetch); each draws at both lanes' own frames
  if (laneLinks) {
    for (let i = 0; i + 1 < rowAssemblies.length; i++) {
      const upperAssembly = rowAssemblies[i]!
      const lowerAssembly = rowAssemblies[i + 1]!
      const upper = rowFrames.get(upperAssembly)
      const lower = rowFrames.get(lowerAssembly)
      const links = laneLinks.get(`${upperAssembly}|${lowerAssembly}`)
      if (upper && lower && links) {
        const y1 = glyphTop(i + 1) + glyphHeight
        const y2 = glyphTop(i + 2)
        for (const link of links) {
          const mate = link.get('mate') as {
            refName: string
            start: number
            end: number
          }
          if (
            link.get('refName') === upper.refName &&
            mate.refName === lower.refName
          ) {
            const a = rowFrameX(upper, link.get('start'), width)
            const b = rowFrameX(upper, link.get('end'), width)
            const c = rowFrameX(lower, mate.start, width)
            const d = rowFrameX(lower, mate.end, width)
            if (Math.max(Math.abs(b - a), Math.abs(d - c)) < MIN_RIBBON_PX) {
              continue
            }
            ribbons.push(
              <path
                key={`link-${i}-${link.id()}`}
                d={ribbonPath(
                  a < b ? [a, b] : [b, a],
                  y1,
                  c < d ? [c, d] : [d, c],
                  y2,
                )}
                fill={ribbonColor}
              />,
            )
          }
        }
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
              utrColor={
                selectedFeatureId === gene.id()
                  ? 'red'
                  : readConfObject(model.configuration, 'utrColor', {
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
