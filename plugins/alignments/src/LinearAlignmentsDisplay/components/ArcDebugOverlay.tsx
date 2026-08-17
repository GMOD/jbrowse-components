import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { resolveArcBandDebug } from './arcHitTest.ts'

import type { ArcMark } from '../../features/arcs/mark.ts'
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

// How wide the mark actually draws, which is what the label list ranks on. A
// dome's is its `rx`; a bar's is the half-length it was widened to, and reading
// the dome's field for both is how a read cloud used to be ranked by radii no
// bar on screen had.
function drawnHalfWidth(mark: ArcMark) {
  return mark.kind === 'bar' ? mark.halfPx : mark.rx
}

// One mark in the vocabulary `arcMark` resolves, with the numbers that describe
// THAT kind — a bar has no radii and a dome has no bar extent, so neither line
// can print a number about a shape the renderer did not paint.
function describeMark(mark: ArcMark) {
  return mark.kind === 'bar'
    ? `FLAT(bar) half=${mark.halfPx.toFixed(0)} destY=${mark.destY.toFixed(0)}`
    : `${mark.far ? 'FAR(circle)' : 'near(ellipse)'} ` +
        `rx=${mark.rx.toFixed(0)} ry=${mark.ry.toFixed(0)} ` +
        `aspect=${(mark.rx / Math.max(mark.ry, 1e-6)).toFixed(2)}`
}

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
        sec.arcsRpcDataMap.get(region.displayedRegionIndex),
        {
          region,
          band: sec,
          scroll: model.scrollModel,
          lineWidth: model.readConnectionsLineWidth,
          arcsYDomainBp: model.arcsYDomainBp,
          canvasWidthPx: model.canvasWidthPx,
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
          .sort((a, b) => drawnHalfWidth(b.mark) - drawnHalfWidth(a.mark))
          .slice(0, 6)
        // The block's own scissor rect. Drawing the band full-width said the
        // pass was scissored to the track, which is the one thing this overlay
        // exists to show and was the one thing it got wrong — and in the
        // multi-region view the region loop above was added to serve, it drew
        // every region's band as the same rect on top of itself.
        const clipId = `arc-debug-clip-${model.id}-${bi}`
        return (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- positional list, rebuilt whole from the model each render; nothing here holds state to mis-reuse
          <g key={bi}>
            <defs>
              <clipPath id={clipId}>
                <rect {...band.clip} />
              </clipPath>
            </defs>
            <rect className={classes.band} {...band.clip} />
            {/* Clipped to the same rect the renderers cut the paint to. An
                unclipped trace over a clipped paint is a disagreement this
                overlay would report as a finding, having created it. */}
            <g clipPath={`url(#${clipId})`}>
              <line
                className={classes.ceiling}
                x1={band.clip.x}
                x2={band.clip.x + band.clip.width}
                y1={band.legacyCeilingY}
                y2={band.legacyCeilingY}
              />
              {band.shapes.map((s, i) => (
                // eslint-disable-next-line @eslint-react/no-array-index-key -- the arc's own dedup key (`arcKey`) does not cross into `ArcsUploadData`, and x1/x2/yBp alone can collide across color and shape types
                <path key={i} className={classes.shape} d={s.d} />
              ))}
            </g>
            {labelled.map((s, i) => (
              <g
                // eslint-disable-next-line @eslint-react/no-array-index-key -- the index IS the identity here: it is the label's row in the stack, as the transform below reads
                key={`l${i}`}
                transform={`translate(${band.clip.x + 6} ${band.clip.y + 12 + i * 12})`}
              >
                <rect
                  className={classes.labelBg}
                  x={-4}
                  y={-9}
                  width={330}
                  height={12}
                />
                <text className={classes.label}>
                  {`${describeMark(s.mark)} ` +
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
