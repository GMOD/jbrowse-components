import { isAbnormalConnection } from '@jbrowse/alignments-core'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { alpha } from '@jbrowse/core/ui/palette'
import { assembleLocString, bezierConnectorPath } from '@jbrowse/core/util'
import {
  HIDDEN_SEGMENT_DASH,
  discordantDipPx,
  hiddenSegmentsNote,
} from '@jbrowse/sv-core'
import { observer } from 'mobx-react'

import { readIdOf, readNameOf, readSpanOf } from '../readChains.ts'
import { CONNECTION_ALPHA } from './connectionStyle.ts'
import {
  OverlayPaths,
  alignmentWidgetOpener,
  buildPairTooltip,
  chainHighlightRects,
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
  const { model, trackId } = props
  const palette = usePalette()
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
        const rows = model.connectorRows(trackId)
        const styleOf = model.connectionStylerIn(trackId, palette)
        return (
          model.drawnConnectionsByTrack.get(trackId) ?? []
        ).flatMap<PathSpec>(drawn => {
          const { connection, chainIndex, c1, c2, kind, bp1, s1, bp2, s2 } =
            drawn
          const { e1, e2, isSplit, hiddenSegmentsBetween } = connection
          const end1 = getX(e1.level, e1.refName, bp1)
          const end2 = getX(e2.level, e2.refName, bp2)
          if (!end1 || !end2) {
            return []
          }
          const abnormal = isAbnormalConnection(kind)
          const { color, label } = styleOf(drawn)
          // Endpoint 1 is read1's 3' edge; endpoint 2 is the next segment's 5'
          // leading edge for a split junction, or the mate's 3' edge for a
          // pair. A discordant connection within one view dips below the
          // reads; across views the curve already spans the divider.
          const y1 = getY(e1.level, c1)
          const y2 = getY(e2.level, c2)
          const level = levels[e1.level]!
          const path = bezierConnectorPath({
            x1: end1.x,
            y1,
            x2: end2.x,
            y2,
            s1,
            s2,
            leadingEnd2: isSplit,
            reversed1: end1.reversed,
            reversed2: end2.reversed,
            // A dip stays inside its own track: this view clips nothing per
            // track, so a deeper one would cross the tracks below. The band is
            // the room under the lower end, and only a same-contig connection
            // has a span.
            dipPx:
              e1.level === e2.level && abnormal
                ? discordantDipPx(
                    level.yOffset + level.height - Math.max(y1, y2),
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
              stroke: alpha(color, CONNECTION_ALPHA),
              strokeDasharray: hiddenNote ? HIDDEN_SEGMENT_DASH : undefined,
              tooltip: () =>
                buildPairTooltip(
                  entryLabel(e1),
                  entryLabel(e2),
                  hiddenNote ? [label, hiddenNote] : [label],
                ),
              highlights: () =>
                chainHighlightRects({
                  entries: chains[chainIndex]!.entries,
                  entryLayouts,
                  rows,
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
