import { connectedVariantJunctions } from './connectedJunctions.ts'
import { connectionKeyRows } from './connectionStyle.ts'

import type { BreakpointViewModel } from '../model.ts'
import type { StyledConnection } from './connectionStyle.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

export const VARIANT_JUNCTION_LABEL = 'Variant call'

// The overlay's key in sections: the variant calls, then each drawn alignment
// connector's color and label in `theme`, one row per color, and one for those
// through regions not shown.
export function drawnConnectionKeySections(
  model: BreakpointViewModel,
  theme: JBrowsePalette,
  trackIds = model.overlayTracks.map(t => String(t.configuration.trackId)),
) {
  const drawnTrackIds = trackIds.filter(
    trackId =>
      !model.getMatchedTracks(trackId).some(t => t.displays[0]?.regionTooLarge),
  )
  const styled: StyledConnection[] = []
  for (const trackId of drawnTrackIds) {
    const styleOf = model.connectionStylerIn(trackId, theme)
    for (const drawn of model.drawnConnectionsByTrack.get(trackId) ?? []) {
      styled.push({
        kind: drawn.kind,
        ...styleOf(drawn),
        throughHidden: !!drawn.connection.hiddenSegmentsBetween?.length,
      })
    }
  }
  const drawsVariantCall = drawnTrackIds.some(trackId => {
    const match = model.overlayMatches.get(trackId)
    return (
      !!match &&
      connectedVariantJunctions({
        match,
        views: model.views,
        assemblies: model.assemblies,
        tracks: model.getMatchedTracks(trackId),
      }).length > 0
    )
  })
  return [
    {
      title: 'Calls',
      rows: drawsVariantCall
        ? [
            {
              key: VARIANT_JUNCTION_LABEL,
              color: theme.variantCall,
              label: VARIANT_JUNCTION_LABEL,
            },
          ]
        : [],
    },
    { title: 'Reads', rows: connectionKeyRows(styled) },
  ].filter(section => section.rows.length > 0)
}

// The same key as one list of rows, each section under a heading row when
// there is more than one.
export function drawnConnectionKey(
  model: BreakpointViewModel,
  theme: JBrowsePalette,
  trackIds?: string[],
) {
  const sections = drawnConnectionKeySections(model, theme, trackIds)
  return sections.flatMap(({ title, rows }) =>
    sections.length > 1
      ? [{ key: title, label: title, color: undefined }, ...rows]
      : rows,
  )
}
