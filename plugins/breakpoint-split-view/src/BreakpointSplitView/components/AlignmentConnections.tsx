import { readLeadingBp, readTrailingBp } from '@jbrowse/cigar-utils'
import {
  bezierConnectorPath,
  getSession,
  getStrokeProps,
} from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import BreakpointTooltip from './BreakpointTooltip.tsx'
import { useOrientationColor } from './getOrientationColor.tsx'
import {
  LEFT,
  RIGHT,
  buildPairTooltip,
  createAlignmentMouseHandlers,
  getCanonicalRefPair,
  getTestId,
  isLevelPairMinimized,
  useMouseoverElt,
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
  const session = getSession(model)
  const [mouseoverElt, setMouseoverElt] = useMouseoverElt()
  const match = model.overlayMatches.get(trackId)
  const { tracks, yOffsets, heights, getX, getY } = model.getTrackOverlayData(
    trackId,
    yOffsetsOverride,
    domYOffsets,
  )
  if (!assembly || !match) {
    return null
  }
  const { layoutMatches, hasPairedReads: hasPaired, allFeatures } = match

  const connections = layoutMatches.flatMap(chunk =>
    chunk.slice(0, -1).flatMap((item, i) => {
      const { layout: c1, feature: f1, level: level1 } = item
      const { layout: c2, feature: f2, level: level2 } = chunk[i + 1]!
      if (isLevelPairMinimized(tracks, level1, level2)) {
        return []
      }
      if (!showIntraviewLinks && level1 === level2) {
        return []
      }
      const refs = getCanonicalRefPair(
        assembly,
        f1.get('refName'),
        f2.get('refName'),
      )
      if (!refs) {
        return []
      }
      const { f1ref, f2ref } = refs
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
      const orientationColor = orientation?.color ?? ''
      const isAbnormal = orientation?.abnormal ?? false
      const colorReason =
        orientation?.label ??
        'interchromosomal connection (different reference sequences)'
      // First endpoint: this segment's read-trailing (3') edge. Second: the
      // mate's 3' edge for a pair, or the next segment's read-leading (5') edge
      // for a split junction (shared rule — see @jbrowse/cigar-utils).
      const p1 = readTrailingBp(s1, c1[LEFT], c1[RIGHT])
      const p2 = hasPaired
        ? readTrailingBp(s2, c2[LEFT], c2[RIGHT])
        : readLeadingBp(s2, c2[LEFT], c2[RIGHT])
      const x1 = getX(level1, f1ref, p1)
      const x2 = getX(level2, f2ref, p2)
      if (x1 == null || x2 == null) {
        return []
      }
      const reversed1 = views[level1]!.pxToBp(x1).reversed
      const reversed2 = views[level2]!.pxToBp(x2).reversed
      const y1 = getY(level1, c1)
      const y2 = getY(level2, c2)
      const sameLevel = level1 === level2
      const abnormalSpecialRenderFlag = sameLevel && isAbnormal
      const trackHeight = abnormalSpecialRenderFlag ? heights[level1]! : 0
      const y0 = yOffsets[level1]!
      const cy1 = abnormalSpecialRenderFlag
        ? Math.min(y0 + trackHeight, y1 + trackHeight)
        : y1
      const cy2 = abnormalSpecialRenderFlag
        ? Math.min(y0 + trackHeight, y2 + trackHeight)
        : y2
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
      const id = `${f1.id()}-${f2.id()}`
      return [
        {
          id,
          path,
          orientationColor,
          f1id: f1.id(),
          f2id: f2.id(),
          tooltip: buildPairTooltip(f1, f2, colorReason),
        },
      ]
    }),
  )
  const hoveredConnection = connections.find(c => c.id === mouseoverElt)

  return (
    <g fill="none" data-testid={getTestId(trackId, layoutMatches.length > 0)}>
      {connections.map(({ id, path, orientationColor, f1id, f2id }) => (
        <path
          d={path}
          key={id}
          data-testid="r1"
          pointerEvents={interactiveOverlay ? 'auto' : undefined}
          strokeWidth={mouseoverElt === id ? 5 : 1}
          {...getStrokeProps(orientationColor || theme.palette.text.disabled)}
          {...createAlignmentMouseHandlers(
            id,
            setMouseoverElt,
            session,
            allFeatures.get(f1id)?.toJSON(),
            allFeatures.get(f2id)?.toJSON(),
          )}
        />
      ))}
      {hoveredConnection ? (
        <BreakpointTooltip contents={hoveredConnection.tooltip} />
      ) : null}
    </g>
  )
})

export default AlignmentConnections
