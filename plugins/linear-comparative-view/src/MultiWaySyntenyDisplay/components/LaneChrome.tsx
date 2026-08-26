import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { getBpDisplayStr } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { frameTickXs } from '../layoutMultiWay.ts'

import type { Lane } from '../laneStack.ts'
import type { MultiWaySyntenyDisplayModel } from '../model.ts'

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US')
}

/**
 * An opaque band per mate lane.
 *
 * Every lane below the anchor is drawn in its OWN coordinate frame, and the
 * view's gridlines — painted under the whole track at the ANCHOR's bp ticks —
 * are therefore true on the top lane and a lie on every other one. The bands
 * stop them at the anchor, and give the stack the row grouping it otherwise
 * reads without: header, ticks and glyphs as one unit, with the ribbons in the
 * gutters between. They TILE — a lane owns half the gutter on each side — so
 * the gridlines are covered everywhere below the anchor rather than standing in
 * the gaps.
 */
export const LaneBands = observer(function LaneBands({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const palette = usePalette()
  const { lanes } = model.laneStack
  const width = model.canvasWidth
  return (
    <>
      {lanes.map((lane, row) =>
        row === 0 ? null : (
          <g key={`band-${lane.assemblyName}`}>
            <rect
              x={0}
              y={lane.bandStart}
              width={width}
              height={lane.bandEnd - lane.bandStart}
              fill={palette.background.paper}
            />
            {row % 2 === 1 ? (
              <rect
                x={0}
                y={lane.bandStart}
                width={width}
                height={lane.bandEnd - lane.bandStart}
                fill={palette.action.hover}
              />
            ) : null}
          </g>
        ),
      )}
    </>
  )
})

/**
 * Each lane's own ticks, all at ONE bp interval: two lanes whose ticks line up
 * are at the same bp-per-pixel, and a lane whose ticks crowd together is zoomed
 * out by the ratio the spacing shows. Same ink as the gridlines the bands
 * cover, in the frame where it means something.
 */
export const LaneTicks = observer(function LaneTicks({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const palette = usePalette()
  const { lanes, bandHeight } = model.laneStack
  const { showLaneTicks, tickIntervalBp, canvasWidth: width } = model
  if (!showLaneTicks) {
    return null
  }
  return (
    <>
      {lanes.flatMap(lane =>
        lane.frame
          ? frameTickXs(lane.frame, tickIntervalBp, width).map(x => (
              <line
                key={`tick-${lane.assemblyName}-${Math.round(x)}`}
                x1={x}
                x2={x}
                y1={lane.bandTop}
                y2={lane.bandTop + bandHeight}
                stroke={palette.gridlineMinor}
              />
            ))
          : [],
      )}
    </>
  )
})

/**
 * What a lane's header says on the right: the span, because a range makes the
 * reader subtract two eight-digit numbers to answer "how zoomed is this lane",
 * and the multiple only where it is not 1 — so a stack of lanes at the anchor's
 * own scale says so by staying quiet. Against `visibleBpSpan`, which is the
 * unit the ladder rounded the lane's span to.
 */
function scaleLabelOf(lane: Lane, visibleBpSpan: number) {
  if (lane.isAnchor) {
    return visibleBpSpan > 0 ? getBpDisplayStr(visibleBpSpan) : ''
  }
  if (lane.frame === undefined) {
    return ''
  }
  const laneSpan = lane.frame.max - lane.frame.min
  const multiple = visibleBpSpan > 0 ? laneSpan / visibleBpSpan : 1
  return multiple > 1.02
    ? `${getBpDisplayStr(laneSpan)}  ${Number(multiple.toFixed(1))}×`
    : getBpDisplayStr(laneSpan)
}

export const LaneHeaders = observer(function LaneHeaders({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const palette = usePalette()
  const view = model.lgv
  const { lanes } = model.laneStack
  const { visibleBpSpan, canvasWidth: width } = model
  return (
    <>
      {lanes.map(lane => {
        const where = lane.isAnchor
          ? view.coarseVisibleLocStrings || view.visibleLocStrings
          : lane.frame &&
            `${lane.canon(lane.frame.refName)}:${fmt(lane.frame.min)}${lane.frame.flipped ? ' [rev]' : ''}`
        return (
          <g key={`header-${lane.assemblyName}`}>
            <text
              x={2}
              y={lane.glyphTop - 3}
              fontSize={10}
              fill={palette.text.primary}
            >
              {/* `no annotation` is a claim about the SESSION, so it asks
                  whether a track exists rather than whether this window drew
                  any genes */}
              {[
                lane.assemblyName,
                where,
                lane.hasAnnotation ? undefined : '· no annotation',
              ]
                .filter(part => !!part)
                .join('  ')}
            </text>
            <text
              x={width - 2}
              y={lane.glyphTop - 3}
              fontSize={10}
              textAnchor="end"
              fill={palette.text.secondary}
            >
              {scaleLabelOf(lane, visibleBpSpan)}
            </text>
          </g>
        )
      })}
    </>
  )
})
