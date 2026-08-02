import { readConfObject } from '@jbrowse/core/configuration'
import { isSyntenyTrack } from '@jbrowse/synteny-core'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { TrackInit } from '@jbrowse/plugin-linear-genome-view'

// The shape read off a launching view's open tracks — a structural type rather
// than LinearGenomeViewModel so this stays a pure function over two fields, and
// so both launch paths (the per-alignment right-click and the region rubberband)
// can call it without agreeing on a view type.
export interface SourceViewTrack {
  configuration: AnyConfigurationModel
  displays: { type: string }[]
}

/**
 * What the anchor panel of a launched synteny view opens with: the tracks the
 * view it was launched from has open.
 *
 * A launch used to hand back two blank panels, so the first thing anyone did
 * with a new synteny view was reopen, one panel at a time, the tracks they were
 * already looking at. The assembly the launch is anchored on is by definition
 * the one the source view is showing, so its track list transfers exactly; the
 * mate panels can't be served this way, since nothing in the source view says
 * what a *different* assembly should show.
 *
 * Synteny tracks are dropped. The chain track the launch came from is about to
 * be drawn as the ribbon band between the panels, and copying it into a panel as
 * well would draw the same alignments a second time, as a row of blocks inside
 * the thing they connect.
 *
 * The display TYPE travels, the display's state does not. A track the user
 * switched to another display (a variant track read as a genotype matrix) should
 * arrive as that display, but a snapshot would also carry the source display's
 * id and its per-view geometry into a panel that is a different size — so the
 * new panel builds a fresh display of the same type, at that type's own default
 * height.
 */
export function anchorPanelTracks(tracks: SourceViewTrack[]): TrackInit[] {
  return tracks
    .filter(track => !isSyntenyTrack(track.configuration))
    .map(track => {
      const trackId = readConfObject(track.configuration, 'trackId') as string
      const type = track.displays[0]?.type
      return type ? { trackId, type } : { trackId }
    })
}
