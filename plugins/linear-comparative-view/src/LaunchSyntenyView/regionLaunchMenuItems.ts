import { lazy } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { getSyntenyTracks } from '@jbrowse/synteny-core'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'

import { makeMateDiscovery } from './discoverMates.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  AbstractViewContainer,
  AbstractViewModel,
  AssemblyHost,
  DialogHost,
  NotificationSink,
  Region,
  RpcHost,
  TrackCatalog,
} from '@jbrowse/core/util'

/**
 * What launching a synteny view from a region asks of its host: an assembly to
 * resolve the region's tracks against, an RPC to discover their mates, a dialog
 * to choose among them, somewhere to report a failure, and a slot to put the
 * launched view in.
 */
export interface SyntenyLaunchHost
  extends
    AbstractViewContainer,
    AssemblyHost,
    DialogHost,
    NotificationSink,
    RpcHost,
    TrackCatalog {}
import type { TrackInit } from '@jbrowse/core/util/tracks'

const LaunchSyntenyViewForRegionDialog = lazy(
  () => import('./LaunchSyntenyViewForRegionDialog.tsx'),
)

interface LaunchableTrack {
  trackId: string
  name: string
  conf: AnyConfigurationModel
}

// The synteny datasets the launching view has OPEN that touch `assemblyName`.
//
// This used to search the whole session (allSessionTracks, so a connection's
// tracks counted too) on the grounds that the launch shouldn't require the
// synteny track to be open — someone browsing genes should still be offered it.
// But a config is free to declare a dozen synteny tracks with none of them open,
// and all of them landed in the dialog's selector with the first in CONFIG ORDER
// preselected: a choice the user never knowingly made, deciding a panel list
// they have no way to judge, on a menu entry they had no reason to expect.
// Sorting the open ones to the front didn't help the case that needed it, which
// is the one where none are open.
//
// The launch means "this locus, in the data I am looking at" — the same premise
// as the per-alignment right-click in LGVSyntenyDisplay, which is open-scoped
// for free because you got there by clicking a feature in the track. What this
// gives up is a synteny track configured but closed, and that is what the import
// form behind Add -> Linear synteny view is for: it picks any session track by
// design. Here, opening the track first is one action, and an informative one —
// its ribbons are what say the locus aligns anywhere at all.
//
// Still filtered rather than assumed: an open synteny track references the
// view's assembly by definition, but it may name an alias of it, which is what
// getSyntenyTracks resolves through.
function launchableTracks(
  session: AssemblyHost & TrackCatalog,
  assemblyName: string,
  openTracks: AnyConfigurationModel[],
): LaunchableTrack[] {
  return getSyntenyTracks(
    openTracks,
    [assemblyName],
    session.assemblyManager,
  ).map(conf => ({
    trackId: readConfObject(conf, 'trackId') as string,
    name: getTrackName(conf, session),
    conf,
  }))
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

// One menu item that opens a synteny view on `region`, or nothing when none of
// the view's open tracks covers it. Which dataset the panels are cut from
// changes what the view shows, so it is a choice — but it is made in the dialog
// alongside the panels and the window size, not in the menu: a view can have
// several synteny tracks open, and the dialog is where picking one can refetch
// the panel list it decides.
export function syntenyRegionMenuItems({
  label,
  region,
  session,
  openTracks,
  anchorTracks,
  sourceView,
}: {
  label: string
  region: Region | undefined
  session: SyntenyLaunchHost
  // the launching view's open track configs, which are the datasets on offer
  openTracks: AnyConfigurationModel[]
  // the launching view's own tracks, offered to the panel that opens on its
  // assembly (the region's). Resolved by the caller, which has the view
  anchorTracks: TrackInit[]
  // the launching view, which the dialog offers to swap for the launched one
  sourceView?: AbstractViewModel
}): MenuItem[] {
  const roi = region ? toWholeBpRegion(region) : undefined
  const tracks = roi
    ? launchableTracks(session, roi.assemblyName, openTracks)
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
