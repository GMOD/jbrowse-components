import { connectionEndpointBps } from '@jbrowse/cigar-utils'
import { bezierConnectorPath } from '@jbrowse/core/util'
import { HIDDEN_SEGMENT_DASH, hiddenSegmentsNote } from '@jbrowse/sv-core'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { useOrientationColor } from './getOrientationColor.tsx'
import { computeOverlayX } from './overlayGeometry.ts'
import {
  LEFT,
  OverlayPaths,
  RIGHT,
  alignmentWidgetOpener,
  buildPairTooltip,
  chainHighlightRects,
  isDrawnByPileup,
  isReversed,
  resolvedPairs,
} from './overlayUtils.tsx'

import type { OverlayProps, PathSpec } from './overlayUtils.tsx'

const AlignmentConnections = observer(function AlignmentConnections(
  props: OverlayProps,
) {
  const { showIntraviewLinks } = props.model
  const theme = useTheme()
  const { getPairedOrientation, getLongReadOrientation } = useOrientationColor()
  return (
    <OverlayPaths
      {...props}
      pathTestId="r1"
      strokeWidth={1}
      hoverStrokeWidth={5}
      render={ctx => {
        const {
          session,
          match,
          assemblies,
          tracks,
          levels,
          layouts,
          getX,
          getY,
        } = ctx
        const { layoutMatches, hasPairedReads: hasPaired } = match
        return [
          ...resolvedPairs({ match, assemblies, tracks }),
        ].flatMap<PathSpec>(
          ({
            f1,
            f2,
            chunkIndex,
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
            // First endpoint: this segment's read-trailing (3') edge. Second:
            // the mate's 3' edge for a pair, or the next segment's read-leading
            // (5') edge for a split junction (shared rule — see
            // @jbrowse/cigar-utils).
            const { bp1: p1, bp2: p2 } = connectionEndpointBps({
              s1,
              start1: c1[LEFT],
              end1: c1[RIGHT],
              s2,
              start2: c2[LEFT],
              end2: c2[RIGHT],
              isSplit: !hasPaired,
            })
            const rawX1 = getX(level1, f1ref, p1)
            const rawX2 = getX(level2, f2ref, p2)
            if (rawX1 == null || rawX2 == null) {
              return []
            }
            // An off-display segment's endpoint is clamped into its panel so the
            // bottom-edge terminus getY gives it is actually on screen — see
            // computeOverlayX.
            const x1 = computeOverlayX(rawX1, layouts[level1]!.width, c1)
            const x2 = computeOverlayX(rawX2, layouts[level2]!.width, c2)
            const y1 = getY(level1, c1)
            const y2 = getY(level2, c2)
            // Endpoint 1 is read1's 3' edge; endpoint 2 is the next segment's 5'
            // leading edge for a split junction, or the mate's 3' edge for a
            // pair. Same shared curve as the alignments overlay. A discordant
            // connection within one view dips below the reads; across views the
            // curve already spans the divider, so the shape is free to read as a
            // plain connector.
            const path = bezierConnectorPath({
              x1,
              y1,
              x2,
              y2,
              s1,
              s2,
              leadingEnd2: !hasPaired,
              reversed1: isReversed(layouts, level1, x1),
              reversed2: isReversed(layouts, level2, x2),
              dip: level1 === level2 && isAbnormal,
            })
            const hiddenNote = hiddenSegmentsBetween?.length
              ? hiddenSegmentsNote(hiddenSegmentsBetween)
              : undefined
            return [
              {
                id: `${f1.id()}-${f2.id()}`,
                path,
                // the chunk is the read chain, so hovering any one of its
                // junctions emphasizes all of them and boxes every segment
                emphasisGroup: `chunk-${chunkIndex}`,
                stroke: orientation?.color ?? theme.palette.text.disabled,
                strokeDasharray: hiddenNote ? HIDDEN_SEGMENT_DASH : undefined,
                tooltip: () =>
                  buildPairTooltip(
                    f1,
                    f2,
                    hiddenNote
                      ? `${colorReason}<br/>${hiddenNote}`
                      : colorReason,
                  ),
                // The whole chunk rather than the hovered junction's two ends: a
                // multi-hop rearrangement routinely runs across three or four
                // panels, and the chain is what the hover is asking about.
                highlights: () =>
                  chainHighlightRects({
                    chunk: layoutMatches[chunkIndex]!,
                    assemblies,
                    tracks,
                    levels,
                    layouts,
                  }),
                openWidget: alignmentWidgetOpener(session, f1, f2),
              },
            ]
          },
        )
      }}
    />
  )
})

export default AlignmentConnections
