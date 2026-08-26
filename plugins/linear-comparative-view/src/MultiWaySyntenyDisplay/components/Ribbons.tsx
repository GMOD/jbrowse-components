import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { observer } from 'mobx-react'

import type { Lane } from '../laneStack.ts'
import type { Span } from '../layoutMultiWay.ts'
import type { MultiWaySyntenyDisplayModel } from '../model.ts'
import type { Feature } from '@jbrowse/core/util'

// ribbons narrower than this on both ends are clutter at alignment-record
// density; the blocks they connect are still drawn in the lanes
const MIN_RIBBON_PX = 2

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

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US')
}

// Every adjacent lane pair, with the two y values a ribbon between them spans:
// out of the upper lane's glyph bottom and into the lower lane's glyph top.
function* lanePairs(lanes: Lane[], glyphHeight: number, from = 0) {
  for (let row = from; row + 1 < lanes.length; row++) {
    const upper = lanes[row]!
    const lower = lanes[row + 1]!
    yield {
      row,
      upper,
      lower,
      y1: upper.glyphTop + glyphHeight,
      y2: lower.glyphTop,
    }
  }
}

interface RibbonSpec {
  key: string
  groupKey: string
  feature: Feature
  d: string
}

/**
 * The ortholog ribbons, one per pair of runs two adjacent lanes both place.
 *
 * Their own observer: hovering one recolors every ribbon of that group, and the
 * lane layer resolves a jexl color slot per gene, which a hover has no business
 * re-running.
 */
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
            style={{ cursor: 'pointer' }}
            onClick={() => {
              model.selectFeature(spec.feature)
            }}
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

export const GroupRibbons = observer(function GroupRibbons({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const { lanes, glyphHeight } = model.laneStack
  const { drawCurves } = model
  const specs: RibbonSpec[] = []
  for (const { row, upper, lower, y1, y2 } of lanePairs(lanes, glyphHeight)) {
    for (const [key, { group, spans }] of upper.placements) {
      for (const [i, s1] of spans.entries()) {
        for (const [j, s2] of (
          lower.placements.get(key)?.spans ?? []
        ).entries()) {
          if (wideEnough(s1, s2)) {
            specs.push({
              key: `ribbon-${row}-${key}-${i}-${j}`,
              groupKey: key,
              // the group's own pairwise feature, so a ribbon's click opens
              // what its boxes open — and it is a far bigger target than they
              // are
              feature: group.feature,
              d: ribbonPath(s1, y1, s2, y2, drawCurves),
            })
          }
        }
      }
    }
  }
  return <RibbonLayer model={model} specs={specs} />
})

/**
 * The direct alignment records between adjacent MATE lanes, out of the
 * per-pair fetch an alignment-level source issues. From row 1: the anchor
 * lane's correspondence is the ortholog table's own, drawn above.
 */
export const LinkRibbons = observer(function LinkRibbons({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const { lanes, glyphHeight } = model.laneStack
  const { laneLinks, ribbonColor, drawCurves } = model
  if (!laneLinks) {
    return null
  }
  const out: React.ReactNode[] = []
  for (const { row, upper, lower, y1, y2 } of lanePairs(
    lanes,
    glyphHeight,
    1,
  )) {
    for (const link of laneLinks.get(
      `${upper.assemblyName}|${lower.assemblyName}`,
    ) ?? []) {
      const mate = link.get('mate') as {
        refName: string
        start: number
        end: number
      }
      // clipped to both frames — and the refName check is the same call, since
      // a lane maps nothing off the contig its frame sits on. An endpoint the
      // frame does not reach would extrapolate to tens of thousands of px and
      // sweep the ribbon across the page, and the fetch window is wider than
      // the frame by construction
      const s1 = upper.spanOf(
        link.get('refName'),
        link.get('start'),
        link.get('end'),
      )
      const s2 = lower.spanOf(mate.refName, mate.start, mate.end)
      if (s1 && s2 && wideEnough(s1, s2)) {
        // the alignment record's own strand, which the pairwise renderer reads
        // for the same reason: -1 means the record's two ends correspond
        // crosswise
        const ordered: Span = link.get('strand') === -1 ? [s2[1], s2[0]] : s2
        out.push(
          <path
            key={`link-${row}-${link.id()}`}
            d={ribbonPath(s1, y1, ordered, y2, drawCurves)}
            fill={ribbonColor}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              model.selectFeature(link)
            }}
          >
            <title>
              {`${upper.assemblyName} ${link.get('refName')}:${fmt(link.get('start'))}-${fmt(link.get('end'))}\n${lower.assemblyName} ${mate.refName}:${fmt(mate.start)}-${fmt(mate.end)}`}
            </title>
          </path>,
        )
      }
    }
  }
  return <>{out}</>
})

/**
 * The hovered group outlined in every lane that places it, over the glyphs.
 *
 * The ribbons alone carried the hover, and a ribbon joins ADJACENT lanes only —
 * so a group the middle lane does not place lit up nothing at all, and the
 * glyph the reader is actually looking at never moved. Its own observer for the
 * same reason `RibbonLayer` is.
 */
export const GroupHighlight = observer(function GroupHighlight({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const palette = usePalette()
  const { hoveredGroupKey } = model
  const { lanes, glyphHeight } = model.laneStack
  if (hoveredGroupKey === undefined) {
    return null
  }
  return (
    <>
      {lanes.flatMap(lane =>
        (lane.placements.get(hoveredGroupKey)?.spans ?? []).map(span => (
          <rect
            key={`hover-${lane.assemblyName}-${span[0]}-${span[1]}`}
            x={Math.min(span[0], span[1]) - 1}
            y={lane.glyphTop - 1}
            width={Math.max(2, Math.abs(span[1] - span[0]) + 2)}
            height={glyphHeight + 2}
            fill="none"
            stroke={palette.text.primary}
            pointerEvents="none"
          />
        )),
      )}
    </>
  )
})
