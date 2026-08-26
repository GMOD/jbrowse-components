import { readConfObject } from '@jbrowse/core/configuration'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { getBpDisplayStr, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { axisSpan } from '../anchorAxis.ts'
import {
  frameSpan,
  frameTickXs,
  geneGlyphShape,
  groupSpansOnRow,
  isAnnotated,
  laneGeometry,
} from '../layoutMultiWay.ts'

import type { RowFrame, Span } from '../layoutMultiWay.ts'
import type { MultiWaySyntenyDisplayModel } from '../model.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'

// ribbons narrower than this on both ends are clutter at alignment-record
// density; the blocks they connect are still drawn in the lanes
const MIN_RIBBON_PX = 2

interface RibbonSpec {
  key: string
  groupKey: string
  d: string
}

interface Lane {
  assemblyName: string
  assembly: Assembly | undefined
  // the top lane, drawn on the view's own axis rather than in a frame of its own
  isAnchor: boolean
  // undefined on the anchor lane, and on a mate lane the visible groups place
  // nothing on
  frame: RowFrame | undefined
  genes: Feature[] | undefined
  // the visible groups' px spans on this lane, one entry per run of placements
  // the lane shows
  spans: Map<string, Span[]>
  glyphTop: number
  bandTop: number
  bandStart: number
  bandEnd: number
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

function wideEnough(s1: Span, s2: Span) {
  return (
    Math.max(Math.abs(s1[1] - s1[0]), Math.abs(s2[1] - s2[0])) >= MIN_RIBBON_PX
  )
}

function onCanvas(span: Span, width: number) {
  return Math.max(span[0], span[1]) >= 0 && Math.min(span[0], span[1]) <= width
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
// px frame `spanOf` maps this lane's intervals through — the view's axis on the
// anchor lane, the lane's own frame below it, both already clipped to what
// their frame reaches. `span` is the whole gene through the same map. Direction
// is resolved in pixel space, so a gene on a flipped lane points the way it
// reads there.
function GeneGlyph({
  feature,
  span,
  spanOf,
  y,
  glyphHeight,
  canvasWidth,
  color,
  utrColor,
  strokeColor,
  onClick,
}: {
  feature: Feature
  span: Span
  spanOf: (start: number, end: number) => Span | undefined
  y: number
  glyphHeight: number
  canvasWidth: number
  color: string
  utrColor: string
  strokeColor: string
  onClick: () => void
}) {
  const [l, r] = span
  const strand = feature.get('strand') ?? 0
  const pxDir = strand === 0 ? 0 : l <= r ? strand : -strand
  const [left, right] = l < r ? [l, r] : [r, l]
  const mid = y + glyphHeight / 2
  const { full, thin } = geneGlyphShape(feature)

  const toPx = (start: number, end: number): Span | undefined => {
    const px = spanOf(start, end)
    return px === undefined ? undefined : px[0] < px[1] ? px : [px[1], px[0]]
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
        // walked over the CANVAS, not over the intron: a lane's frame reaches
        // only the canvas but the view's axis runs the whole displayed region,
        // so an intron on the anchor lane is as wide in px as the zoom makes it
        // — a 50kb intron at 1bp/px is fifty thousand pixels of off-screen
        // chevrons in one path string, rebuilt on every pan
        const to = Math.min(blockStart, canvasWidth + CHEVRON_SPACING_PX)
        const skipped = Math.max(
          0,
          Math.floor((-CHEVRON_SPACING_PX - prevEnd) / CHEVRON_SPACING_PX),
        )
        for (
          let x = prevEnd + CHEVRON_SPACING_PX * (skipped + 0.5);
          x <= to - CHEVRON_SPACING_PX / 2;
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
      {arrow ? <path d={arrow} stroke={strokeColor} fill="none" /> : null}
      <title>{feature.get('name') ?? feature.id()}</title>
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
            <title>{spec.groupKey}</title>
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
    anchorAssembly,
    anchorAssemblyName,
    anchorSpans,
    canvasWidth: width,
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
  if (!anchorAssembly) {
    return null
  }

  // What a lane calls its sequence. A placement carries whatever refName the
  // table's BED used, a gene whatever that assembly's GFF3 used, and for a
  // genome whose annotation names sequences by INSDC accession those are
  // `CM028642.2` and `3L`. The assembly's own alias table closes that; raw
  // `===` between two file spellings drops every gene.
  const canon = (lane: Lane, refName: string) =>
    lane.assembly?.getCanonicalRefName2(refName) ?? refName

  // How a lane maps one of its own bp intervals to px, or `undefined` for an
  // interval the lane does not reach: the anchor lane through the view's own
  // axis, every other lane through its own frame. Both clip rather than test —
  // see `axisSpan` and `frameSpan` — so a feature straddling the edge draws the
  // half the lane can place.
  const laneSpanOf = (lane: Lane) => {
    const { frame } = lane
    if (lane.isAnchor) {
      return (refName: string, start: number, end: number) =>
        axisSpan(view, canon(lane, refName), start, end)
    }
    const frameRefName = frame && canon(lane, frame.refName)
    return (refName: string, start: number, end: number) =>
      frame && canon(lane, refName) === frameRefName
        ? frameSpan(frame, start, end, width)
        : undefined
  }

  const names = [anchorAssemblyName, ...rowAssemblies]
  const { glyphHeight, bandHeight, rows } = laneGeometry(height, names.length)
  const lanes: Lane[] = names.map((assemblyName, row) => {
    const frame = row === 0 ? undefined : rowFrames.get(assemblyName)
    const spans = new Map<string, Span[]>()
    for (const group of visibleGroups) {
      const anchorSpan = anchorSpans.get(group.key)
      const laneSpans =
        row === 0
          ? anchorSpan
            ? [anchorSpan]
            : []
          : frame
            ? groupSpansOnRow(group, assemblyName, frame, width)
            : []
      if (laneSpans.length) {
        spans.set(group.key, laneSpans)
      }
    }
    return {
      assemblyName,
      assembly: assemblyManager.get(assemblyName),
      isAnchor: row === 0,
      frame,
      genes: laneGenes?.get(assemblyName),
      spans,
      ...rows[row]!,
    }
  })

  // Every lane below the anchor is drawn in its OWN coordinate frame, and the
  // view's gridlines — painted under the whole track at the ANCHOR's bp ticks —
  // are therefore true on the top lane and a lie on every other one. An opaque
  // band per mate lane stops them at the anchor, and gives the stack the row
  // grouping it otherwise reads without: header, ticks and glyphs as one unit,
  // with the ribbons in the gutters between.
  const bands: React.ReactNode[] = []
  for (const [row, lane] of lanes.entries()) {
    if (row > 0) {
      const pitch = lane.bandEnd - lane.bandStart
      bands.push(
        <rect
          key={`band-${row}`}
          x={0}
          y={lane.bandStart}
          width={width}
          height={pitch}
          fill={palette.background.paper}
        />,
      )
      if (row % 2 === 1) {
        bands.push(
          <rect
            key={`tint-${row}`}
            x={0}
            y={lane.bandStart}
            width={width}
            height={pitch}
            fill={palette.action.hover}
          />,
        )
      }
    }
  }

  // Each lane's own ticks, all at ONE bp interval: two lanes whose ticks line
  // up are at the same bp-per-pixel, and a lane whose ticks crowd together is
  // zoomed out by the ratio the spacing shows. Same ink as the gridlines the
  // bands cover, in the frame where it means something.
  const ticks: React.ReactNode[] = []
  if (showLaneTicks) {
    for (const [row, lane] of lanes.entries()) {
      if (lane.frame) {
        for (const x of frameTickXs(lane.frame, tickIntervalBp, width)) {
          ticks.push(
            <line
              key={`tick-${row}-${Math.round(x)}`}
              x1={x}
              x2={x}
              y1={lane.bandTop}
              y2={lane.bandTop + bandHeight}
              stroke={palette.gridlineMinor}
            />,
          )
        }
      }
    }
  }

  const ribbonSpecs: RibbonSpec[] = []
  for (let row = 0; row + 1 < lanes.length; row++) {
    const upper = lanes[row]!
    const lower = lanes[row + 1]!
    for (const [groupKey, uppers] of upper.spans) {
      for (const [i, s1] of uppers.entries()) {
        for (const [j, s2] of (lower.spans.get(groupKey) ?? []).entries()) {
          if (wideEnough(s1, s2)) {
            ribbonSpecs.push({
              key: `ribbon-${row}-${groupKey}-${i}-${j}`,
              groupKey,
              d: ribbonPath(
                s1,
                upper.glyphTop + glyphHeight,
                s2,
                lower.glyphTop,
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
    for (let row = 1; row + 1 < lanes.length; row++) {
      const upper = lanes[row]!
      const lower = lanes[row + 1]!
      const links = laneLinks.get(`${upper.assemblyName}|${lower.assemblyName}`)
      if (upper.frame && lower.frame && links) {
        const upperX = laneSpanOf(upper)
        const lowerX = laneSpanOf(lower)
        for (const link of links) {
          const mate = link.get('mate') as {
            refName: string
            start: number
            end: number
          }
          // clipped to both frames — and the refName check is the same call,
          // since a lane maps nothing off the contig its frame sits on. An
          // endpoint the frame does not reach would extrapolate to tens of
          // thousands of px and sweep the ribbon across the page, and the fetch
          // window is wider than the frame by construction
          const s1 = upperX(
            link.get('refName'),
            link.get('start'),
            link.get('end'),
          )
          const s2 = lowerX(mate.refName, mate.start, mate.end)
          if (s1 && s2 && wideEnough(s1, s2)) {
            // the alignment record's own strand, which the pairwise renderer
            // reads for the same reason: -1 means the record's two ends
            // correspond crosswise
            const ordered: Span =
              link.get('strand') === -1 ? [s2[1], s2[0]] : s2
            linkRibbons.push(
              <path
                key={`link-${row}-${link.id()}`}
                d={ribbonPath(
                  s1,
                  upper.glyphTop + glyphHeight,
                  ordered,
                  lower.glyphTop,
                  drawCurves,
                )}
                fill={ribbonColor}
              >
                <title>
                  {`${upper.assemblyName} ${link.get('refName')}:${fmt(link.get('start'))}-${fmt(link.get('end'))}\n${lower.assemblyName} ${mate.refName}:${fmt(mate.start)}-${fmt(mate.end)}`}
                </title>
              </path>,
            )
          }
        }
      }
    }
  }

  // What a lane's header says on the right: the span, because a range makes
  // the reader subtract two eight-digit numbers to answer "how zoomed is this
  // lane", and the multiple only where it is not 1 — so a stack of lanes at
  // the anchor's own scale says so by staying quiet. Against `visibleBpSpan`,
  // which is the unit the ladder rounded the lane's span to.
  const scaleLabelOf = (row: number, frame: RowFrame | undefined) => {
    if (row === 0) {
      return visibleBpSpan > 0 ? getBpDisplayStr(visibleBpSpan) : ''
    }
    if (frame === undefined) {
      return ''
    }
    const laneSpan = frame.max - frame.min
    const multiple = visibleBpSpan > 0 ? laneSpan / visibleBpSpan : 1
    return multiple > 1.02
      ? `${getBpDisplayStr(laneSpan)}  ${Number(multiple.toFixed(1))}×`
      : getBpDisplayStr(laneSpan)
  }

  const glyphs: React.ReactNode[] = []
  const headers: React.ReactNode[] = []
  for (const [row, lane] of lanes.entries()) {
    const { assemblyName, frame, genes } = lane
    const y = lane.glyphTop
    const spanOf = laneSpanOf(lane)
    glyphs.push(
      <line
        key={`baseline-${assemblyName}`}
        x1={0}
        x2={width}
        y1={y + glyphHeight / 2}
        y2={y + glyphHeight / 2}
        stroke={palette.divider}
      />,
    )

    // the genes this lane can actually draw, not the ones it fetched: the fetch
    // covers the whole window the frame slides in, so a frame over a gene
    // desert can hold a non-empty list and show none of it. Culled to the
    // canvas on screen, the way the arc display culls, and kept whole on the
    // export path, which captures the region rather than the viewport: the
    // anchor lane's fetch spans the static blocks, so a third of what it holds
    // is off either edge
    const drawn = (genes ?? []).flatMap(gene => {
      const span = spanOf(
        gene.get('refName'),
        gene.get('start'),
        gene.get('end'),
      )
      return span === undefined || (!exportSVG && !onCanvas(span, width))
        ? []
        : [{ gene, span }]
    })
    for (const { gene, span } of drawn) {
      const selected = selectedFeatureId === gene.id()
      glyphs.push(
        <GeneGlyph
          key={`gene-${assemblyName}-${gene.id()}`}
          feature={gene}
          span={span}
          spanOf={(start, end) => spanOf(gene.get('refName'), start, end)}
          y={y}
          glyphHeight={glyphHeight}
          canvasWidth={width}
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

    // Where the lane has no annotation over a group it places, the table's own
    // gene span, outlined rather than filled: without that the stack states a
    // placement box and a real gene model in the same ink, and one flat box
    // across a lane reads as a single enormous gene.
    //
    // Per GROUP rather than per lane. Per lane, one drawn gene anywhere
    // suppressed every box, so a table pairing genes the lane's GFF3 does not
    // name left the ribbons for those hanging off nothing at all.
    const annotated = drawn.map(d => d.span)
    for (const group of visibleGroups) {
      for (const [i, span] of (lane.spans.get(group.key) ?? []).entries()) {
        if (isAnnotated(annotated, span)) {
          continue
        }
        // a box, unlike a ribbon, wants the ends the low-to-high way round
        const [boxLeft, boxRight] =
          span[0] <= span[1] ? span : [span[1], span[0]]
        const selected = selectedFeatureId === group.feature.id()
        const color = selected
          ? palette.highlight.main
          : readConfObject(model.configuration, 'color', {
              feature: group.feature,
            })
        glyphs.push(
          <rect
            key={`glyph-${row}-${group.key}-${i}`}
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
            <title>{group.key}</title>
          </rect>,
        )
      }
    }

    const where =
      row === 0
        ? view.coarseVisibleLocStrings || view.visibleLocStrings
        : frame &&
          `${canon(lane, frame.refName)}:${fmt(frame.min)}${frame.flipped ? ' [rev]' : ''}`
    // `no annotation` is a claim about the SESSION, so it asks whether a track
    // exists rather than whether this window drew any genes
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
        {scaleLabelOf(row, frame)}
      </text>,
    )
  }

  const body = (
    <>
      {bands}
      <RibbonLayer model={model} specs={ribbonSpecs} />
      {linkRibbons}
      {ticks}
      {glyphs}
      {headers}
    </>
  )
  return exportSVG ? (
    body
  ) : (
    <svg width={width} height={height}>
      {body}
    </svg>
  )
})

export default MultiWayRows
