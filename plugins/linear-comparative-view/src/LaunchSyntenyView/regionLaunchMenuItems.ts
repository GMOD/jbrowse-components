import { lazy } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { allSessionTracks, getSyntenyTracks } from '@jbrowse/synteny-core'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'

import { makeMateDiscovery } from './discoverMates.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  AbstractSessionModel,
  AbstractViewModel,
  Region,
} from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/plugin-linear-genome-view'

const LaunchSyntenyViewForRegionDialog = lazy(
  () => import('./LaunchSyntenyViewForRegionDialog.tsx'),
)

interface LaunchableTrack {
  trackId: string
  name: string
  conf: AnyConfigurationModel
}

// Synteny datasets anywhere in the session that touch `assemblyName`.
// allSessionTracks rather than session.tracks so a dataset arriving from a
// connection counts, and session-wide rather than the view's own tracks because
// the launch does not need the synteny track to be open — someone browsing
// genes should still be offered it.
//
// That reach is also why the offer is a dialog rather than a menu of datasets:
// a config can declare dozens of synteny tracks with none of them open, and all
// of them land here. `openTrackIds` puts the view's own tracks at the front, so
// the dataset the user is actually looking at is the one the dialog opens on
// and the rest are a scroll away rather than an equal wall of names.
function launchableTracks(
  session: AbstractSessionModel,
  assemblyName: string,
  openTrackIds: string[],
): LaunchableTrack[] {
  const tracks = getSyntenyTracks(
    allSessionTracks(session),
    [assemblyName],
    session.assemblyManager,
  ).map(conf => ({
    trackId: readConfObject(conf, 'trackId') as string,
    name: getTrackName(conf, session),
    conf,
  }))
  return [
    ...tracks.filter(track => openTrackIds.includes(track.trackId)),
    ...tracks.filter(track => !openTrackIds.includes(track.trackId)),
  ]
}

// The one block a launch runs on, out of however many the view or the selection
// covers. A synteny panel is anchored on one stable sequence, so a span crossing
// a region boundary has to pick: the widest, which is the sequence the user is
// mostly looking at. Taking the first instead means a view scrolled just past a
// boundary launches on the trailing sliver of the region behind it, and a
// selection dragged across one launches on however few bp sat to the left of it
// — `getSelectedRegions` returns `[{ctgA 49,998-50,001}, {ctgB 0-9}]` for a drag
// that is mostly ctgB, so every panel would be framed on 3 bp.
//
// Widest in bp rather than in pixels: a dynamic block carries widthPx and a
// selected region does not, and within one view bpPerPx is uniform, so the two
// orders agree.
export function widestRegion<T extends { start: number; end: number }>(
  regions: T[],
): T | undefined {
  return regions.reduce<T | undefined>(
    (best, region) =>
      best && best.end - best.start >= region.end - region.start
        ? best
        : region,
    undefined,
  )
}

// Whole base pairs, and only the four fields a Region is. A rubberband
// selection already arrives floored, but a dynamic block does not: its bounds
// are fractional (see calculateDynamicBlocks), and toLocale renders a
// fractional bp as `1,234,6.6,789` — which is what the dialog title showed for
// the visible-region launch. Rebuilding the fields also drops the block's pixel
// bookkeeping (offsetPx/widthPx/key) before the region crosses the RPC boundary.
export function toWholeBpRegion(region: Region): Region {
  return {
    assemblyName: region.assemblyName,
    refName: region.refName,
    start: Math.floor(region.start),
    end: Math.ceil(region.end),
  }
}

// One menu item that opens a synteny view on `region`, or nothing when no
// dataset in the session covers it. Which dataset the panels are cut from
// changes what the view shows, so it is a choice — but it is made in the dialog
// alongside the panels and the window size, not in the menu: discovery is
// session-wide (see launchableTracks), so the list has no ceiling, and a
// cascading submenu of every synteny track in a config is worse than no naming
// at all.
//
// Mirrors the graph-genome-view launcher's discovery deliberately (session-wide,
// off what the track declares); the menu shapes diverge because that launch has
// no dialog to move the choice into.
export function syntenyRegionMenuItems({
  label,
  region,
  session,
  openTrackIds,
  anchorTracks,
  sourceView,
}: {
  label: string
  region: Region | undefined
  session: AbstractSessionModel
  openTrackIds: string[]
  // the launching view's own tracks, offered to the panel that opens on its
  // assembly (the region's). Resolved by the caller, which has the view
  anchorTracks: TrackInit[]
  // the launching view, which the dialog offers to swap for the launched one
  sourceView?: AbstractViewModel
}): MenuItem[] {
  const roi = region ? toWholeBpRegion(region) : undefined
  const tracks = roi
    ? launchableTracks(session, roi.assemblyName, openTrackIds)
    : []
  return roi && tracks.length
    ? [
        {
          label,
          icon: CompareArrowsIcon,
          onClick: () => {
            session.queueDialog(handleClose => [
              LaunchSyntenyViewForRegionDialog,
              {
                session,
                region: roi,
                tracks: tracks.map(({ trackId, name }) => ({ trackId, name })),
                anchorTracks,
                sourceView,
                discoverMatesFor: (trackId: string) =>
                  makeMateDiscovery({
                    session,
                    track: tracks.find(track => track.trackId === trackId)!
                      .conf,
                    region: roi,
                  }),
                handleClose,
              },
            ])
          },
        },
      ]
    : []
}
