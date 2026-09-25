import { connectionEndpoints } from '@jbrowse/alignments-core'
import { assembleLocString, bezierConnectorPath } from '@jbrowse/core/util'
import {
  HIDDEN_SEGMENT_DASH,
  discordantDipPx,
  hiddenSegmentsNote,
} from '@jbrowse/sv-core'
import { observer } from 'mobx-react'

import { readIdOf, readNameOf, readSpanOf } from '../readChains.ts'
import { useConnectionStyle } from './connectionStyle.ts'
import {
  OverlayPaths,
  alignmentWidgetOpener,
  buildPairTooltip,
  chainHighlightRects,
  drawnConnections,
  readTooltipLabel,
} from './overlayUtils.tsx'

import type { ReadEntry } from '../readChains.ts'
import type { OverlayProps, PathSpec } from './overlayUtils.tsx'

function entryLabel(e: ReadEntry) {
  return readTooltipLabel(
    readNameOf(e),
    assembleLocString({ refName: e.refName, ...readSpanOf(e) }),
  )
}

const AlignmentConnections = observer(function AlignmentConnections(
  props: OverlayProps,
) {
  const { showIntraviewLinks } = props.model
  const connectionStyle = useConnectionStyle()
  return (
    <OverlayPaths
      {...props}
      pathTestId="r1"
      strokeWidth={1}
      hoverStrokeWidth={5}
      render={ctx => {
        const { session, match, tracks, levels, layouts, getX, getY } = ctx
        if (match.kind !== 'alignment') {
          return []
        }
        const { chains, layouts: entryLayouts } = match
        return [
          ...drawnConnections({
            chains,
            entryLayouts,
            tracks,
            levels,
            showIntraviewLinks,
          }),
        ].flatMap<PathSpec>(({ connection, chainIndex, c1, c2, kind }) => {
          const { e1, e2, isSplit, hiddenSegmentsBetween } = connection
          const { bp1, s1, bp2, s2 } = connectionEndpoints(connection)
          const end1 = getX(e1.level, e1.refName, bp1)
          const end2 = getX(e2.level, e2.refName, bp2)
          if (!end1 || !end2) {
            return []
          }
          const { abnormal, color, label } = connectionStyle(kind, isSplit)
          // Endpoint 1 is read1's 3' edge; endpoint 2 is the next segment's 5'
          // leading edge for a split junction, or the mate's 3' edge for a
          // pair. A discordant connection within one view dips below the
          // reads; across views the curve already spans the divider.
          const path = bezierConnectorPath({
            x1: end1.x,
            y1: getY(e1.level, c1),
            x2: end2.x,
            y2: getY(e2.level, c2),
            s1,
            s2,
            leadingEnd2: isSplit,
            reversed1: end1.reversed,
            reversed2: end2.reversed,
            // A dip stays inside the panel it is drawn in: this view clips
            // nothing per level, so a deeper one would bleed over the
            // neighbouring panel's reads. The band is the pileup body below
            // coverage, and only a same-contig connection has a span.
            dipPx:
              e1.level === e2.level && abnormal
                ? discordantDipPx(
                    levels[e1.level]!.height - levels[e1.level]!.coverageOffset,
                    e1.refName === e2.refName ? Math.abs(bp2 - bp1) : undefined,
                  )
                : undefined,
          })
          const hiddenNote = hiddenSegmentsBetween?.length
            ? hiddenSegmentsNote(hiddenSegmentsBetween)
            : undefined
          return [
            {
              id: `${readIdOf(e1)}-${readIdOf(e2)}`,
              path,
              // hovering any junction of a read chain emphasizes all of them
              // and boxes every segment, across every panel it visits
              emphasisGroup: `chain-${chainIndex}`,
              stroke: color,
              strokeDasharray: hiddenNote ? HIDDEN_SEGMENT_DASH : undefined,
              tooltip: () =>
                buildPairTooltip(
                  entryLabel(e1),
                  entryLabel(e2),
                  hiddenNote ? `${label}<br/>${hiddenNote}` : label,
                ),
              highlights: () =>
                chainHighlightRects({
                  entries: chains[chainIndex]!.entries,
                  entryLayouts,
                  tracks,
                  levels,
                  layouts,
                }),
              openWidget: alignmentWidgetOpener(session, tracks, e1, e2),
            },
          ]
        })
      }}
    />
  )
})

export default AlignmentConnections
