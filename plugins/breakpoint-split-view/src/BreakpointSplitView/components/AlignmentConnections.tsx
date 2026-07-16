import { connectionEndpointBps } from '@jbrowse/cigar-utils'
import { bezierConnectorPath, getStrokeProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import BreakpointTooltip from './BreakpointTooltip.tsx'
import { useOrientationColor } from './getOrientationColor.tsx'
import {
  LEFT,
  RIGHT,
  buildPairTooltip,
  createAlignmentMouseHandlers,
  getTestId,
  isReversed,
  resolvedPairs,
  useOverlayState,
} from './overlayUtils.tsx'

import type { OverlayProps } from './overlayUtils.tsx'

const AlignmentConnections = observer(function AlignmentConnections({
  model,
  trackId,
  yOffsetsOverride,
  domYOffsets,
}: OverlayProps) {
  const { interactiveOverlay, views, showIntraviewLinks, assembly } = model
  const theme = useTheme()
  const { getPairedOrientation, getLongReadOrientation } = useOrientationColor()
  const { session, mouseoverElt, setMouseoverElt, match, overlayData } =
    useOverlayState({ model, trackId, yOffsetsOverride, domYOffsets })
  if (!assembly || !match) {
    return null
  }
  const { tracks, levels, getX, getY } = overlayData
  const { layoutMatches, hasPairedReads: hasPaired, allFeatures } = match

  const connections = [...resolvedPairs({ match, assembly, tracks })].flatMap(
    ({
      f1,
      f2,
      level1,
      level2,
      c1,
      c2,
      f1ref,
      f2ref,
      hiddenSegmentsBetween,
    }) => {
      if (!showIntraviewLinks && level1 === level2) {
        return []
      }
      const s1 = f1.get('strand')!
      const s2 = f2.get('strand')!
      const sameRef = f1ref === f2ref
      const orientation = sameRef
        ? hasPaired
          ? getPairedOrientation({
              pair_orientation: f1.get('pair_orientation') as
                string | undefined,
            })
          : getLongReadOrientation(s1, s2)
        : undefined
      const isAbnormal = orientation?.abnormal ?? false
      const colorReason =
        orientation?.label ??
        'interchromosomal connection (different reference sequences)'
      // First endpoint: this segment's read-trailing (3') edge. Second: the
      // mate's 3' edge for a pair, or the next segment's read-leading (5') edge
      // for a split junction (shared rule — see @jbrowse/cigar-utils).
      const { bp1: p1, bp2: p2 } = connectionEndpointBps({
        s1,
        start1: c1[LEFT],
        end1: c1[RIGHT],
        s2,
        start2: c2[LEFT],
        end2: c2[RIGHT],
        isSplit: !hasPaired,
      })
      const x1 = getX(level1, f1ref, p1)
      const x2 = getX(level2, f2ref, p2)
      if (x1 == null || x2 == null) {
        return []
      }
      const reversed1 = isReversed(views, level1, x1)
      const reversed2 = isReversed(views, level2, x2)
      const y1 = getY(level1, c1)
      const y2 = getY(level2, c2)
      const sameLevel = level1 === level2
      const abnormalSpecialRenderFlag = sameLevel && isAbnormal
      // Same-row abnormal connections bow the bezier's control points down to
      // the track's bottom edge. getY always clamps within the track, so both
      // endpoints resolve to this same edge.
      const { yOffset, height } = levels[level1]!
      const trackBottom = yOffset + height
      const cy1 = abnormalSpecialRenderFlag ? trackBottom : y1
      const cy2 = abnormalSpecialRenderFlag ? trackBottom : y2
      // Cross-view connections in a stacked split view use a fixed 200px handle
      // (ends are separated vertically). Endpoint 1 is read1's 3' edge; endpoint
      // 2 is the next segment's 5' leading edge for a split junction, or the
      // mate's 3' edge for a pair. Same shared curve as the alignments overlay.
      const path = bezierConnectorPath({
        x1,
        y1,
        x2,
        y2,
        s1,
        s2,
        leadingEnd2: !hasPaired,
        reversed1,
        reversed2,
        handlePx: 200,
        cy1,
        cy2,
      })
      const hiddenNote = hiddenSegmentsBetween?.length
        ? `hidden segment${hiddenSegmentsBetween.length > 1 ? 's' : ''} not in view: ${hiddenSegmentsBetween.join(', ')}`
        : undefined
      return [
        {
          id: `${f1.id()}-${f2.id()}`,
          path,
          orientationColor: orientation?.color,
          f1id: f1.id(),
          f2id: f2.id(),
          hiddenSegment: !!hiddenNote,
          tooltip: hiddenNote
            ? `${buildPairTooltip(f1, f2, colorReason)}<br/>${hiddenNote}`
            : buildPairTooltip(f1, f2, colorReason),
        },
      ]
    },
  )
  const hoveredConnection = connections.find(c => c.id === mouseoverElt)

  return (
    <g fill="none" data-testid={getTestId(trackId, layoutMatches.length > 0)}>
      {connections.map(
        ({ id, path, orientationColor, f1id, f2id, hiddenSegment }) => (
          <path
            d={path}
            key={id}
            data-testid="r1"
            pointerEvents={interactiveOverlay ? 'auto' : undefined}
            strokeWidth={mouseoverElt === id ? 5 : 1}
            strokeDasharray={hiddenSegment ? '4 3' : undefined}
            {...getStrokeProps(orientationColor ?? theme.palette.text.disabled)}
            {...createAlignmentMouseHandlers(
              id,
              setMouseoverElt,
              session,
              allFeatures.get(f1id)?.toJSON(),
              allFeatures.get(f2id)?.toJSON(),
            )}
          />
        ),
      )}
      {hoveredConnection ? (
        <BreakpointTooltip contents={hoveredConnection.tooltip} />
      ) : null}
    </g>
  )
})

export default AlignmentConnections
