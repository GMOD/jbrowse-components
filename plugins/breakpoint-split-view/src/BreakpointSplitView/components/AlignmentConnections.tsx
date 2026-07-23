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
  isDrawnByPileup,
  isReversed,
  resolvedPairs,
  useOverlayState,
} from './overlayUtils.tsx'

import type { OverlayProps } from './overlayUtils.tsx'
import type { Feature } from '@jbrowse/core/util'

function connectionTooltip({
  f1,
  f2,
  colorReason,
  hiddenNote,
}: {
  f1: Feature
  f2: Feature
  colorReason: string
  hiddenNote: string | undefined
}) {
  const base = buildPairTooltip(f1, f2, colorReason)
  return hiddenNote ? `${base}<br/>${hiddenNote}` : base
}

const AlignmentConnections = observer(function AlignmentConnections({
  model,
  trackId,
  yOffsetsOverride,
  domYOffsets,
}: OverlayProps) {
  const { interactiveOverlay, showIntraviewLinks, assembly } = model
  const theme = useTheme()
  const { getPairedOrientation, getLongReadOrientation } = useOrientationColor()
  const { session, mouseoverElt, setMouseoverElt, match, overlayData } =
    useOverlayState({ model, trackId, yOffsetsOverride, domYOffsets })
  if (!assembly || !match) {
    return null
  }
  const { tracks, levels, layouts, getX, getY } = overlayData
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
      if (level1 === level2) {
        if (
          !showIntraviewLinks ||
          isDrawnByPileup({ level: level1, levels, c1, c2 })
        ) {
          return []
        }
      }
      const s1 = f1.get('strand')!
      const s2 = f2.get('strand')!
      const sameRef = f1ref === f2ref
      const orientation = sameRef
        ? hasPaired
          ? getPairedOrientation({
              pair_orientation: f1.get('pair_orientation') as
                | string
                | undefined,
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
      const reversed1 = isReversed(layouts, level1, x1)
      const reversed2 = isReversed(layouts, level2, x2)
      const y1 = getY(level1, c1)
      const y2 = getY(level2, c2)
      // Endpoint 1 is read1's 3' edge; endpoint 2 is the next segment's 5'
      // leading edge for a split junction, or the mate's 3' edge for a pair.
      // Same shared curve as the alignments overlay. A discordant connection
      // within one view dips below the reads; across views the curve already
      // spans the divider, so the shape is free to read as a plain connector.
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
        dip: level1 === level2 && isAbnormal,
      })
      const hiddenNote = hiddenSegmentsBetween?.length
        ? `hidden segment${hiddenSegmentsBetween.length > 1 ? 's' : ''} not in view: ${hiddenSegmentsBetween.join(', ')}`
        : undefined
      return [
        {
          id: `${f1.id()}-${f2.id()}`,
          path,
          orientationColor: orientation?.color,
          f1,
          f2,
          colorReason,
          hiddenNote,
          hiddenSegment: !!hiddenNote,
        },
      ]
    },
  )
  const hoveredConnection = connections.find(c => c.id === mouseoverElt)
  // Only the hovered connection's tooltip is ever shown, and building one walks
  // both features' fields — so it's resolved here rather than for all N.
  const hoveredTooltip = hoveredConnection
    ? connectionTooltip(hoveredConnection)
    : undefined

  return (
    <g fill="none" data-testid={getTestId(trackId, layoutMatches.length > 0)}>
      {connections.map(
        ({ id, path, orientationColor, f1, f2, hiddenSegment }) => (
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
              () => ({
                feature1: allFeatures.get(f1.id())?.toJSON(),
                feature2: allFeatures.get(f2.id())?.toJSON(),
              }),
            )}
          />
        ),
      )}
      {hoveredTooltip ? <BreakpointTooltip contents={hoveredTooltip} /> : null}
    </g>
  )
})

export default AlignmentConnections
