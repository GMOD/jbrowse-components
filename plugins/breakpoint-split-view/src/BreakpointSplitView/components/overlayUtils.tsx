import { Fragment } from 'react'

import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import {
  assembleLocString,
  bezierConnectorPath,
  getSession,
  getStrokeProps,
  truncateMiddle,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { readIdOf } from '../readChains.ts'
import { computeOverlayRect } from '../util.ts'
import BreakpointTooltip from './BreakpointTooltip.tsx'
import { connectionKeyRows } from './connectionStyle.ts'

import type { BreakpointViewModel } from '../model.ts'
import type { ReadEntry } from '../readChains.ts'
import type { LayoutRecord, OverlayLevel, OverlayMatch } from '../types.ts'
import type { OverlayTrack } from '../util.ts'
import type { StyledConnection } from './connectionStyle.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { Feature } from '@jbrowse/core/util'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'

export interface OverlayProps {
  model: BreakpointViewModel
  trackId: string
  /** SVG export: each row's track top, none where the row minimizes it */
  yOffsetsOverride?: (number | undefined)[]
}

// One place the overlay opens a feature widget: the two kinds differ only in
// which widget takes the click and what it is handed.
function openFeatureWidget(
  session: ReturnType<typeof getSession>,
  widgetType: string,
  widgetId: string,
  featureData: unknown,
) {
  const widget = session.addWidget?.(widgetType, widgetId, { featureData })
  if (widget) {
    session.showWidget?.(widget)
  }
}

// Both openers serialize their features at click time, not per render: every
// overlay path in the view would otherwise pay for a `toJSON` on every pan/zoom
// frame to fill in a widget nobody has opened.
export function variantWidgetOpener(
  session: ReturnType<typeof getSession>,
  feature: Feature,
) {
  return () => {
    openFeatureWidget(
      session,
      'VariantFeatureWidget',
      'variantFeature',
      feature.toJSON(),
    )
  }
}

// The overlay holds a read's arrays, not its record, so a click fetches both
// full reads from their own rows' displays.
export function alignmentWidgetOpener(
  session: ReturnType<typeof getSession>,
  tracks: Pick<OverlayTrack, 'displays'>[],
  e1: ReadEntry,
  e2: ReadEntry,
) {
  return () => {
    void tracks[e1.level]?.displays[0]?.withFeatureById?.(readIdOf(e1), f1 => {
      void tracks[e2.level]?.displays[0]?.withFeatureById?.(
        readIdOf(e2),
        f2 => {
          openFeatureWidget(
            session,
            'BreakpointAlignmentsWidget',
            'breakpointAlignments',
            { feature1: f1.toJSON(), feature2: f2.toJSON() },
          )
        },
      )
    })
  }
}

export function getTestId(trackId: string, hasMatches: boolean) {
  return hasMatches ? `${trackId}-loaded` : trackId
}

/**
 * The assembly of each row, index-aligned with `views` — `model.assemblies`.
 * A row still loading its assembly is `undefined`, which drops that row's
 * features the same way an unresolvable refName does.
 */
export type RowAssemblies = (Assembly | undefined)[]

/** One placed end of a junction, in overlay px. */
export interface JunctionPoint {
  x: number
  y: number
  /** where the foot over the kept arm ends, from `breakendTickPx` */
  tick: number
  /** which way the sequence this end keeps runs: 1 right, -1 left, 0 unknown */
  keeps: number
  reversed: boolean
}

// A junction as the link mark draws one: a foot over the arm each end keeps,
// and between the ends the connector cubic, which leaves each end on the side
// it joins and bows over a pair on one row.
export function buildJunctionPath(a: JunctionPoint, b: JunctionPoint) {
  const curve = bezierConnectorPath({
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
    s1: -a.keeps,
    s2: -b.keeps,
    reversed1: a.reversed,
    reversed2: b.reversed,
  })
  return `M ${a.tick} ${a.y} L${curve.slice(1)} L ${b.tick} ${b.y}`
}

function featureTooltipLabel(feature: Feature) {
  const name = feature.get('name')
  const loc = assembleLocString({
    refName: feature.get('refName'),
    start: feature.get('start'),
    end: feature.get('end'),
  })
  return readTooltipLabel(name ?? '', loc)
}

function endpointLabel(end: Feature | string) {
  return typeof end === 'string' ? end : featureTooltipLabel(end)
}

export function readTooltipLabel(name: string, loc: string) {
  return name ? `${truncateMiddle(name)} (${loc})` : loc
}

// shared by every overlay type's hover tooltip: two endpoint labels plus any
// reasons (e.g. why the connecting curve is colored a certain way)
export function buildPairTooltip(
  from: Feature | string,
  to: Feature | string,
  reasons: string[] = [],
) {
  return [`${endpointLabel(from)} → ${endpointLabel(to)}`, ...reasons]
}

export interface PathSpec {
  id: string
  path: string
  /**
   * Lazy, and for one reason: only the hovered spec's tooltip and boxes are
   * ever built, and each walks the features behind the curve, so they resolve
   * on hover rather than for all N every frame.
   */
  tooltip?: () => string[]
  highlights?: () => HighlightRect[]
  /** Resolved at click time, for the reason `variantWidgetOpener` gives. */
  openWidget?: () => void
  /**
   * Every spec sharing this reads as hovered together — for an alignments
   * track that is the read chain, so a hover on one junction emphasizes the
   * rest of the read's route. Defaults to the spec's own id, which is one
   * curve emphasizing only itself.
   */
  emphasisGroup?: string
  stroke?: string
  strokeDasharray?: string
}

export interface OverlayContext {
  session: ReturnType<typeof getSession>
  match: OverlayMatch
  assemblies: RowAssemblies
  views: BreakpointViewModel['views']
  tracks: ReturnType<BreakpointViewModel['getTrackOverlayData']>['tracks']
  levels: ReturnType<BreakpointViewModel['getTrackOverlayData']>['levels']
  layouts: ReturnType<BreakpointViewModel['getTrackOverlayData']>['layouts']
  getX: ReturnType<BreakpointViewModel['getTrackOverlayData']>['getX']
  getY: ReturnType<BreakpointViewModel['getTrackOverlayData']>['getY']
}

interface OverlayPathsProps extends OverlayProps {
  pathTestId?: string
  /** stroke width at rest, and the one an emphasized path takes */
  strokeWidth: number
  hoverStrokeWidth: number
  /** group stroke, for a kind whose specs do not each name their own */
  stroke?: string
  render: (ctx: OverlayContext) => PathSpec[]
}

const HIT_STROKE_WIDTH = 10

// Every overlay kind draws the same thing: a set of hoverable curves, the boxes
// the hovered one asks for, and its tooltip. Only what goes into a PathSpec
// differs, which is what `render` supplies — the alignments and the variant
// half each carried their own copy of the walk from hover state to <g>, so a
// fix to one of them (the chain emphasis, the lazy tooltip) had to be made
// twice.
export const OverlayPaths = observer(function OverlayPaths({
  model,
  trackId,
  yOffsetsOverride,
  pathTestId,
  strokeWidth,
  hoverStrokeWidth,
  stroke,
  render,
}: OverlayPathsProps) {
  const { interactiveOverlay, views, assemblies } = model
  const palette = usePalette()
  const session = getSession(model)
  const { hoveredOverlay } = model
  const match = model.overlayMatches.get(trackId)
  const overlayData = model.getTrackOverlayData(trackId, yOffsetsOverride)
  const hoveredId =
    yOffsetsOverride === undefined && hoveredOverlay?.trackId === trackId
      ? hoveredOverlay.id
      : undefined

  if (!match) {
    return null
  }
  const specs = render({ session, match, assemblies, views, ...overlayData })
  const hovered = specs.find(spec => spec.id === hoveredId)
  const emphasis = hovered && (hovered.emphasisGroup ?? hovered.id)
  const isEmphasized = (spec: PathSpec) =>
    (spec.emphasisGroup ?? spec.id) === emphasis
  return (
    <g
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill="none"
      data-testid={getTestId(
        trackId,
        (match.kind === 'variant' ? match.layoutMatches : match.chains).length >
          0,
      )}
    >
      {hovered?.highlights?.().map(({ key, ...rect }) => (
        <rect
          key={key}
          data-testid="chain-highlight"
          {...rect}
          fill={palette.featureHoverStrong}
        />
      ))}
      {specs
        .toSorted((a, b) => Number(isEmphasized(a)) - Number(isEmphasized(b)))
        .map(spec => (
          <Fragment key={spec.id}>
            <path
              d={spec.path}
              data-testid={pathTestId}
              strokeWidth={isEmphasized(spec) ? hoverStrokeWidth : strokeWidth}
              strokeDasharray={spec.strokeDasharray}
              {...(spec.stroke ? getStrokeProps(spec.stroke) : undefined)}
            />
            {yOffsetsOverride === undefined ? (
              <path
                d={spec.path}
                stroke="transparent"
                strokeWidth={Math.max(hoverStrokeWidth, HIT_STROKE_WIDTH)}
                pointerEvents={interactiveOverlay ? 'stroke' : undefined}
                onClick={spec.openWidget}
                onMouseOver={() => {
                  model.setHoveredOverlay({ trackId, id: spec.id })
                }}
                onMouseOut={() => {
                  model.setHoveredOverlay(undefined)
                }}
              />
            ) : null}
          </Fragment>
        ))}
      {hovered?.tooltip ? (
        <BreakpointTooltip lines={hovered.tooltip()} />
      ) : null}
    </g>
  )
})

// The overlay's key: each drawn alignment connector's color and label in
// `theme`, one row per color.
export function drawnConnectionKey(
  model: BreakpointViewModel,
  theme: JBrowsePalette,
  trackIds = model.overlayTracks.map(t => t.configuration.trackId),
) {
  const styled: StyledConnection[] = []
  for (const trackId of trackIds) {
    if (
      !model.getMatchedTracks(trackId).some(t => t.displays[0]?.regionTooLarge)
    ) {
      const styleOf = model.connectionStylerIn(trackId, theme)
      for (const drawn of model.drawnConnectionsByTrack.get(trackId) ?? []) {
        styled.push({ kind: drawn.kind, ...styleOf(drawn) })
      }
    }
  }
  return connectionKeyRows(styled)
}

export interface HighlightRect {
  key: string
  x: number
  y: number
  width: number
  height: number
}

// Boxes over every on-screen segment of one chunk, i.e. of one read chain — what
// a hovered connector is pointing at, which is the thing the overlay could not
// say before.
//
// The whole chunk rather than the hovered connector's two ends: a multi-hop
// rearrangement opens one panel per segment of the route, so a chain routinely
// runs across three or four of them and the chain is what the hover is asking
// about. It also picks up the segments no connector is drawn for, an intra-view
// junction the pileup links itself (`linksReads`), which would otherwise leave
// a visible gap in the middle of the highlighted read.
export function chainHighlightRects({
  entries,
  entryLayouts,
  rows,
  levels,
  layouts,
}: {
  entries: ReadEntry[]
  entryLayouts: ReadonlyMap<ReadEntry, LayoutRecord>
  rows: Pick<OverlayTrack, 'minimized'>[]
  levels: OverlayLevel[]
  layouts: ViewLayout[]
}) {
  const rects: HighlightRect[] = []
  for (const e of entries) {
    const layout = entryLayouts.get(e)
    if (layout && !rows[e.level]?.minimized) {
      const rect = computeOverlayRect({
        level: levels[e.level]!,
        layout,
        refName: e.refName,
        viewLayout: layouts[e.level]!,
      })
      if (rect) {
        // One record fetched by two overlapping windows of a panel is in the
        // chain once per window, so the window is part of the key.
        rects.push({
          key: `${e.level}-${e.displayedRegionIndex}-${readIdOf(e)}`,
          ...rect,
        })
      }
    }
  }
  return rects
}
