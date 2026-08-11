import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { resolveArcBandDebug } from './arcHitTest.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()(() => ({
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    pointerEvents: 'none',
  },
  // The geometry the MODEL believes each arc has. If it does not sit on the
  // painted arc, the disagreement is the finding — that is the whole point of
  // drawing it separately rather than recolouring the arcs themselves.
  shape: {
    fill: 'none',
    stroke: '#00b0ff',
    strokeWidth: 1,
    opacity: 0.9,
  },
  // The depth a dome's apex was pinned to before the clamp came off. Ink lying
  // along it means something is still clamping.
  ceiling: {
    stroke: '#e91e63',
    strokeWidth: 1,
    strokeDasharray: '4 3',
    opacity: 0.9,
  },
  band: {
    fill: 'none',
    stroke: '#7c4dff',
    strokeWidth: 1,
    strokeDasharray: '2 4',
    opacity: 0.8,
  },
  label: {
    fill: '#000',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  labelBg: {
    fill: '#fff',
    opacity: 0.75,
  },
}))

// Draws the arc band's own geometry over the canvas, for answering "why is this
// arc this shape" without guessing from a screenshot.
//
// Three things, and they answer different questions:
//   - the band rect, so it is obvious where the pass is scissored;
//   - the pre-unclamp apex ceiling (ARC_APEX_FRACTION * availH), because a
//     plateau sitting exactly on it is the clamped-dome signature and a flat
//     run somewhere else is not;
//   - every arc's own path, traced from the SAME generated `arcRadiiPx` the
//     renderers read, with rx/ry/aspect printed for the widest few.
//
// Volatile toggle, off by default, no config slot — see `debugArcGeometry`.
const ArcDebugOverlay = observer(function ArcDebugOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { classes } = useStyles()
  const view = getContainingView(model) as LinearGenomeViewModel
  if (!model.debugArcGeometry || model.readConnections === 'off') {
    return null
  }
  // Every section CROSSED WITH every visible region, because that is what the
  // renderer draws: the arc feed is per group per region, each buffer clipped to
  // its own block. Taking `visibleRegions[0]` drew region 0's arcs and left the
  // rest of a multi-region view unannotated — in a view where the arcs actually
  // in question are as likely to be in the second region as the first.
  const bands = model.renderSections.flatMap(sec =>
    view.visibleRegions.flatMap(region => {
      const geom = resolveArcBandDebug(
        model.arcsByGroup.get(sec.groupKey)?.get(region.displayedRegionIndex),
        {
          region,
          band: {
            arcBandTop: sec.arcBandTop,
            arcBandHeight: sec.arcBandHeight,
            arcDown: sec.arcDown,
          },
          scroll: model.scrollModel,
          lineWidth: model.readConnectionsLineWidth,
          arcsYDomainBp: model.arcsYDomainBp,
          canvasWidthPx: view.trackWidthPx,
        },
      )
      return geom ? [geom] : []
    }),
  )
  if (bands.length === 0) {
    return null
  }
  return (
    <svg className={classes.svg} height={model.height}>
      {bands.map((band, bi) => {
        // Widest first, so the labels describe the arcs most likely to be the
        // ones being asked about rather than whichever came first in the feed.
        const labelled = [...band.shapes]
          .sort((a, b) => b.rx - a.rx)
          .slice(0, 6)
        return (
          <g key={bi}>
            <rect
              className={classes.band}
              x={0}
              y={band.arcsTop}
              width="100%"
              height={band.arcsH}
            />
            <line
              className={classes.ceiling}
              x1={0}
              x2="100%"
              y1={band.legacyCeilingY}
              y2={band.legacyCeilingY}
            />
            {band.shapes.map((s, i) => (
              <path key={i} className={classes.shape} d={s.d} />
            ))}
            {labelled.map((s, i) => (
              <g
                key={`l${i}`}
                transform={`translate(6 ${band.arcsTop + 12 + i * 12})`}
              >
                <rect
                  className={classes.labelBg}
                  x={-4}
                  y={-9}
                  width={330}
                  height={12}
                />
                <text className={classes.label}>
                  {`rx=${s.rx.toFixed(0)} ry=${s.ry.toFixed(0)} ` +
                    `aspect=${(s.rx / Math.max(s.ry, 1e-6)).toFixed(2)} ` +
                    `${s.isFlat ? 'FLAT(bar)' : s.far ? 'FAR(circle)' : 'near(ellipse)'} ` +
                    `yBp=${s.yBp} span=${Math.abs(s.x2 - s.x1)}bp n=${s.support}`}
                </text>
              </g>
            ))}
          </g>
        )
      })}
    </svg>
  )
})

export default ArcDebugOverlay
