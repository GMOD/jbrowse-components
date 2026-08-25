import { readConfObject } from '@jbrowse/core/configuration'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { doesIntersect2, getBpDisplayStr, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import {
  frameTickXs,
  geneGlyphShape,
  groupSpansOnRow,
  rowFrameX,
} from '../layoutMultiWay.ts'

import type { MultiWayGroup, RowFrame } from '../layoutMultiWay.ts'
import type { MultiWaySyntenyDisplayModel } from '../model.ts'
import type { Feature } from '@jbrowse/core/util'

type Span = readonly [number, number]

const LABEL_HEIGHT = 12

// ribbons narrower than this on both ends are clutter at alignment-record
// density; the blocks they connect are still drawn in the lanes
const MIN_RIBBON_PX = 2

interface RibbonSpec {
  key: string
  groupKey: string
  name: string
  d: string
}

// The two spans are ORDERED pairs, not intervals: `s1[0]` joins `s2[0]` and
// `s1[1]` joins `s2[1]`. A reverse-strand block hands its lower end reversed
// and the parallelogram comes out crossed, which is the whole of drawing an
// inversion.
function ribbonPath(
  s1: Span,
  y1: number,
  s2: Span,
  y2: number,
  curve: boolean,
) {
  if (curve) {
    const ym = (y1 + y2) / 2
    return `M ${s1[0]} ${y1} C ${s1[0]} ${ym}, ${s2[0]} ${ym}, ${s2[0]} ${y2} L ${s2[1]} ${y2} C ${s2[1]} ${ym}, ${s1[1]} ${ym}, ${s1[1]} ${y1} Z`
  }
  return `M ${s1[0]} ${y1} L ${s2[0]} ${y2} L ${s2[1]} ${y2} L ${s1[1]} ${y1} Z`
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US')
}

// Gene glyph geometry matching the canvas gene track's: UTRs thinner and
// vertically centered, intron lines carrying direction chevrons, an arrowhead
// past the downstream end.
const UTR_HEIGHT_FRACTION = 0.65
const CHEVRON_SPACING_PX = 10
const MIN_CHEVRON_GAP_PX = 8
const MIN_ARROW_GLYPH_PX = 4

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
  strokeColor,
  onClick,
}: {
  feature: Feature
  xOf: (bp: number) => number | undefined
  y: number
  glyphHeight: number
  color: string
  utrColor: string
  strokeColor: string
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
      <line x1={left} x2={right} y1={mid} y2={mid} stroke={strokeColor} />
      {chevrons ? <path d={chevrons} stroke={strokeColor} fill="none" /> : null}
      {thinPx.map(([x1, x2], i) => (
        <rect
          key={`utr-${i}`}
          x={x1}
          y={utrY}
          width={Math.max(1, x2 - x1)}
          height={utrHeight}
          fill={utrColor}
        />
      ))}
      {fullPx.map(([x1, x2], i) => (
        <rect
          key={`cds-${i}`}
          x={x1}
          y={y}
          width={Math.max(1, x2 - x1)}
          height={glyphHeight}
          fill={color}
        />
      ))}
      {arrow ? <path d={arrow} stroke={strokeColor} fill="none" /> : null}
      <title>{feature.get('name') ?? feature.get('id')}</title>
    </g>
  )
}

// The ribbons are their own observer: hovering one recolors every ribbon of
// that ortholog group, and the lane layer above resolves a jexl color slot per
// gene, which a hover has no business re-running.
const RibbonLayer = observer(function RibbonLayer({
  model,
  specs,
}: {
  model: MultiWaySyntenyDisplayModel
  specs: RibbonSpec[]
}) {
  const palette = usePalette()
  const { ribbonColor, hoveredGroupKey } = model
  return (
    <>
      {specs.map(spec => {
        const hovered = hoveredGroupKey === spec.groupKey
        return (
          <path
            key={spec.key}
            d={spec.d}
            fill={hovered ? palette.text.primary : ribbonColor}
            fillOpacity={hovered ? 0.45 : undefined}
            onMouseEnter={() => {
              model.setHoveredGroupKey(spec.groupKey)
            }}
            onMouseLeave={() => {
              model.setHoveredGroupKey(undefined)
            }}
          >
            <title>{spec.name}</title>
          </path>
        )
      })}
    </>
  )
})

const MultiWayRows = observer(function MultiWayRows({
  model,
  exportSVG,
}: {
  model: MultiWaySyntenyDisplayModel
  exportSVG?: boolean
}) {
  const palette = usePalette()
  const view = model.lgv
  const { assemblyManager } = getSession(model)
  const {
    anchorAssemblyName,
    anchorSpans,
    visibleBpSpan,
    rowAssemblies,
    rowFrames,
    visibleGroups,
    laneGenes,
    laneGeneAdapters,
    laneLinks,
    height,
    ribbonColor,
    selectedFeatureId,
    drawCurves,
    showLaneTicks,
    tickIntervalBp,
  } = model
  const assembly = assemblyManager.get(anchorAssemblyName)
  if (!assembly) {
    return null
  }
  const width = model.canvasWidth

  // What a lane's header calls its sequence. A placement carries whatever
  // refName the table's BED used, which for an assembly whose annotation names
  // sequences by INSDC accession is `CM028642.2` where the reader knows the
  // chromosome as `3L`. The assembly's own alias table closes that, the same
  // call the anchor's bpToPx below makes for the opposite reason.
  const anchorX = (refName: string, bp: number) => {
    const px = view.bpToPx({
      refName: assembly.getCanonicalRefName2(refName),
      coord: bp,
    })?.offsetPx
    return px === undefined ? undefined : px - view.offsetPx
  }

  // One lane's refNames resolved into that assembly's own canonical spelling.
  // The lane's two sources of refName are two FILES: the frame's comes from the
  // synteny table's BED, and a gene's from that assembly's GFF3, which for a
  // genome whose annotation names sequences by INSDC accession is `CM028642.2`
  // where the table says `3L`. The RPC resolves each through the alias table on
  // its way out (`afterAttach`) and `renameRegionsIfNeeded` then rewrites it
  // into the adapter's own namespace, so what comes back is the FILE's
  // spelling — never the frame's. Comparing the two raw is the same `===` the
  // assembly-name rule forbids, one level down, and it drops every gene.
  const canonicalRefName = (assemblyName: string, refName: string) =>
    assemblyManager.get(assemblyName)?.getCanonicalRefName2(refName) ?? refName

  const rowCount = rowAssemblies.length + 1
  const glyphHeight = Math.max(
    5,
    Math.min(18, height / rowCount - LABEL_HEIGHT - 6),
  )
  const usable = height - LABEL_HEIGHT - glyphHeight - 4
  const glyphTop = (rowIndex: number) =>
    LABEL_HEIGHT + (rowCount === 1 ? 0 : (rowIndex * usable) / (rowCount - 1))
  const bandTop = (rowIndex: number) => glyphTop(rowIndex) - LABEL_HEIGHT
  const bandHeight = LABEL_HEIGHT + glyphHeight
  // A mate lane's band owns half the gutter on each side, so the bands TILE
  // everything below the anchor lane. A band that covered only its own header
  // and glyphs left the view's gridlines standing in the gaps between lanes,
  // which is most of the ink in a tall track and the whole thing being fixed.
  const bandStart = (rowIndex: number) =>
    (glyphTop(rowIndex - 1) + glyphHeight + bandTop(rowIndex)) / 2
  const bandEnd = (rowIndex: number) =>
    rowIndex + 1 < rowCount ? bandStart(rowIndex + 1) : height

  const frameOf = (rowIndex: number): RowFrame | undefined =>
    rowIndex === 0 ? undefined : rowFrames.get(rowAssemblies[rowIndex - 1]!)

  // one span per run of placements the row shows, so two hits a lane holds
  // apart draw as two blocks with two ribbons rather than as one solid block
  // spanning the gap between them
  const spansOnRow = (group: MultiWayGroup, rowIndex: number): Span[] => {
    if (rowIndex === 0) {
      const anchor = anchorSpans.get(group.key)
      return anchor ? [anchor] : []
    }
    const frame = frameOf(rowIndex)
    return frame
      ? groupSpansOnRow(group, rowAssemblies[rowIndex - 1]!, frame, width)
      : []
  }

  // Every lane below the anchor is drawn in its OWN coordinate frame, and the
  // view's gridlines — painted under the whole track at the ANCHOR's bp ticks —
  // are therefore true on the top lane and a lie on every other one. An opaque
  // band per mate lane stops them at the anchor, and gives the stack the row
  // grouping it otherwise reads without: header, ticks and glyphs as one unit,
  // with the ribbons in the gutters between.
  const bands: React.ReactNode[] = []
  for (let rowIndex = 1; rowIndex < rowCount; rowIndex++) {
    const top = bandStart(rowIndex)
    const bandPitch = bandEnd(rowIndex) - top
    bands.push(
      <rect
        key={`band-${rowIndex}`}
        x={0}
        y={top}
        width={width}
        height={bandPitch}
        fill={palette.background.paper}
      />,
    )
    if (rowIndex % 2 === 1) {
      bands.push(
        <rect
          key={`tint-${rowIndex}`}
          x={0}
          y={top}
          width={width}
          height={bandPitch}
          fill={palette.action.hover}
        />,
      )
    }
  }

  // Each lane's own ticks, all at ONE bp interval: two lanes whose ticks line
  // up are at the same bp-per-pixel, and a lane whose ticks crowd together is
  // zoomed out by the ratio the spacing shows. Same ink as the gridlines the
  // bands cover, in the frame where it means something.
  const ticks: React.ReactNode[] = []
  if (showLaneTicks) {
    for (let rowIndex = 1; rowIndex < rowCount; rowIndex++) {
      const frame = frameOf(rowIndex)
      if (frame) {
        for (const x of frameTickXs(frame, tickIntervalBp, width)) {
          ticks.push(
            <line
              key={`tick-${rowIndex}-${Math.round(x)}`}
              x1={x}
              x2={x}
              y1={bandTop(rowIndex)}
              y2={bandTop(rowIndex) + bandHeight}
              stroke={palette.gridlineMinor}
            />,
          )
        }
      }
    }
  }

  const ribbonSpecs: RibbonSpec[] = []
  for (let rowIndex = 0; rowIndex < rowCount - 1; rowIndex++) {
    for (const group of visibleGroups) {
      const uppers = spansOnRow(group, rowIndex)
      const lowers = spansOnRow(group, rowIndex + 1)
      for (const [i, s1] of uppers.entries()) {
        for (const [j, s2] of lowers.entries()) {
          if (
            Math.max(Math.abs(s1[1] - s1[0]), Math.abs(s2[1] - s2[0])) >=
            MIN_RIBBON_PX
          ) {
            ribbonSpecs.push({
              key: `ribbon-${rowIndex}-${group.key}-${i}-${j}`,
              groupKey: group.key,
              name: group.name,
              d: ribbonPath(
                s1,
                glyphTop(rowIndex) + glyphHeight,
                s2,
                glyphTop(rowIndex + 1),
                drawCurves,
              ),
            })
          }
        }
      }
    }
  }

  // alignment-level sources also carry the direct records between adjacent
  // mate lanes (the per-pair fetch); each draws at both lanes' own frames
  const linkRibbons: React.ReactNode[] = []
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
        const upperRefName = canonicalRefName(upperAssembly, upper.refName)
        const lowerRefName = canonicalRefName(lowerAssembly, lower.refName)
        for (const link of links) {
          const mate = link.get('mate') as {
            refName: string
            start: number
            end: number
          }
          // the alignment record's own strand, which the pairwise renderer
          // reads for the same reason: -1 means the record's two ends
          // correspond crosswise
          const reversed = link.get('strand') === -1
          if (
            canonicalRefName(upperAssembly, link.get('refName')) ===
              upperRefName &&
            canonicalRefName(lowerAssembly, mate.refName) === lowerRefName
          ) {
            const a = rowFrameX(upper, link.get('start'), width)
            const b = rowFrameX(upper, link.get('end'), width)
            const c = rowFrameX(lower, mate.start, width)
            const d = rowFrameX(lower, mate.end, width)
            if (Math.max(Math.abs(b - a), Math.abs(d - c)) >= MIN_RIBBON_PX) {
              linkRibbons.push(
                <path
                  key={`link-${i}-${link.id()}`}
                  d={ribbonPath(
                    [a, b],
                    y1,
                    reversed ? [d, c] : [c, d],
                    y2,
                    drawCurves,
                  )}
                  fill={ribbonColor}
                />,
              )
            }
          }
        }
      }
    }
  }

  // What a lane's header says on the right: the span, because a range makes
  // the reader subtract two eight-digit numbers to answer "how zoomed is this
  // lane", and the multiple only where it is not 1 — so a stack of lanes at
  // the anchor's own scale says so by staying quiet.
  const scaleLabelOf = (rowIndex: number, frame: RowFrame | undefined) => {
    if (rowIndex === 0) {
      // The anchor lane's ink is the view's own Gridlines, at the view's
      // interval — the lane tick loop starts at row 1. Naming `tickIntervalBp`
      // here claimed a grid this display does not draw.
      return visibleBpSpan > 0 ? getBpDisplayStr(visibleBpSpan) : ''
    }
    if (frame === undefined) {
      return ''
    }
    const laneSpan = frame.max - frame.min
    // Against `visibleBpSpan`, which is the unit `snapFrameToLadder` rounded
    // the lane's span to. Dividing by an anchor frame's span instead used a
    // second denominator, so a lane sitting exactly on rung 1 read `1.1x`
    // while its ticks lined up with the anchor's.
    const multiple = visibleBpSpan > 0 ? laneSpan / visibleBpSpan : 1
    return multiple > 1.02
      ? `${getBpDisplayStr(laneSpan)}  ${Number(multiple.toFixed(1))}×`
      : getBpDisplayStr(laneSpan)
  }

  const lanes: React.ReactNode[] = []
  const headers: React.ReactNode[] = []
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const assemblyName =
      rowIndex === 0 ? anchorAssemblyName : rowAssemblies[rowIndex - 1]!
    const frame = frameOf(rowIndex)
    const y = glyphTop(rowIndex)
    const genes = laneGenes?.get(assemblyName)
    const frameRefName = frame && canonicalRefName(assemblyName, frame.refName)
    // How this lane draws a gene, or `undefined` for a lane that cannot: the
    // anchor lane maps bp through the view and shows everything the view
    // fetched, every other lane maps through its own frame and shows what that
    // frame reaches. Derived here so the frame is narrowed once rather than
    // asserted at each of the three places below that read it.
    const geneDrawing =
      rowIndex === 0
        ? {
            shows: () => true,
            xOf: (gene: Feature) => (bp: number) =>
              anchorX(gene.get('refName'), bp),
          }
        : frame === undefined
          ? undefined
          : {
              shows: (gene: Feature) =>
                canonicalRefName(assemblyName, gene.get('refName')) ===
                  frameRefName &&
                doesIntersect2(
                  frame.min,
                  frame.max,
                  gene.get('start'),
                  gene.get('end'),
                ),
              xOf: () => (bp: number) => rowFrameX(frame, bp, width),
            }
    lanes.push(
      <line
        key={`baseline-${assemblyName}`}
        x1={0}
        x2={width}
        y1={y + glyphHeight / 2}
        y2={y + glyphHeight / 2}
        stroke={palette.divider}
      />,
    )

    if (genes?.length && geneDrawing) {
      for (const gene of genes) {
        if (geneDrawing.shows(gene)) {
          const selected = selectedFeatureId === gene.id()
          lanes.push(
            <GeneGlyph
              key={`gene-${assemblyName}-${gene.id()}`}
              feature={gene}
              xOf={geneDrawing.xOf(gene)}
              y={y}
              glyphHeight={glyphHeight}
              strokeColor={palette.text.primary}
              color={
                selected
                  ? palette.highlight.main
                  : readConfObject(model.configuration, 'color', {
                      feature: gene,
                    })
              }
              utrColor={
                selected
                  ? palette.highlight.main
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
      // A lane with no annotation draws the table's own gene spans, outlined
      // rather than filled: without that the stack states a placement box and
      // a real gene model in the same ink, and one flat box across a lane
      // reads as a single enormous gene.
      for (const group of visibleGroups) {
        for (const [i, span] of spansOnRow(group, rowIndex).entries()) {
          // a box, unlike a ribbon, wants the ends the low-to-high way round
          const [boxLeft, boxRight] =
            span[0] <= span[1] ? span : [span[1], span[0]]
          const selected = selectedFeatureId === group.feature.id()
          const color = selected
            ? palette.highlight.main
            : readConfObject(model.configuration, 'color', {
                feature: group.feature,
              })
          lanes.push(
            <rect
              key={`glyph-${rowIndex}-${group.key}-${i}`}
              x={boxLeft}
              y={y + 1}
              width={Math.max(1, boxRight - boxLeft)}
              height={Math.max(1, glyphHeight - 2)}
              fill={color}
              fillOpacity={0.25}
              stroke={color}
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

    const where =
      rowIndex === 0
        ? view.coarseVisibleLocStrings || view.visibleLocStrings
        : frame &&
          `${canonicalRefName(assemblyName, frame.refName)}:${fmt(frame.min)}${frame.flipped ? ' [rev]' : ''}`
    // `no annotation` is a claim about the SESSION, so it asks whether a track
    // exists rather than whether this window drew any genes: a lane with a gene
    // track over an empty stretch draws placement boxes, and calling that `no
    // annotation` would be a claim about the config that is not true
    headers.push(
      <text
        key={`label-${assemblyName}`}
        x={2}
        y={y - 3}
        fontSize={10}
        fill={palette.text.primary}
      >
        {[
          assemblyName,
          where,
          laneGeneAdapters.has(assemblyName) ? undefined : '· no annotation',
        ]
          .filter(part => !!part)
          .join('  ')}
      </text>,
      <text
        key={`scale-${assemblyName}`}
        x={width - 2}
        y={y - 3}
        fontSize={10}
        textAnchor="end"
        fill={palette.text.secondary}
      >
        {scaleLabelOf(rowIndex, frame)}
      </text>,
    )
  }

  const body = (
    <>
      {bands}
      <RibbonLayer model={model} specs={ribbonSpecs} />
      {linkRibbons}
      {ticks}
      {lanes}
      {headers}
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
