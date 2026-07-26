import { lazy } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { allSessionTracks, getSyntenyTracks } from '@jbrowse/synteny-core'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'

import { makeMateDiscovery } from './discoverMates.ts'
import { oneOrManyMenuItem } from './oneOrManyMenuItem.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AbstractSessionModel, Region } from '@jbrowse/core/util'

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
function launchableTracks(
  session: AbstractSessionModel,
  assemblyName: string,
): LaunchableTrack[] {
  return getSyntenyTracks(allSessionTracks(session), [assemblyName]).map(
    conf => ({
      trackId: readConfObject(conf, 'trackId') as string,
      name: getTrackName(conf, session),
      conf,
    }),
  )
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

// Menu items that open a synteny view on `region`, one per synteny dataset that
// could supply it. A single dataset is the common case and gets a flat item —
// a submenu of one is a needless click; several become a submenu naming each,
// since which alignment the panels come from is then a real choice.
//
// Mirrors the graph-genome-view launcher's shape deliberately: same discovery
// (session-wide, off what the track declares), same one-vs-many menu shape, so
// the two "open another view on this region" entries read the same way.
export function syntenyRegionMenuItems({
  label,
  region,
  session,
}: {
  label: string
  region: Region | undefined
  session: AbstractSessionModel
}): MenuItem[] {
  const roi = region ? toWholeBpRegion(region) : undefined
  return roi
    ? oneOrManyMenuItem({
        label,
        icon: CompareArrowsIcon,
        entries: launchableTracks(session, roi.assemblyName),
        entryLabel: track => track.name,
        onSelect: track => () => {
          session.queueDialog(handleClose => [
            LaunchSyntenyViewForRegionDialog,
            {
              session,
              region: roi,
              track: { trackId: track.trackId, name: track.name },
              discoverMates: makeMateDiscovery({
                session,
                track: track.conf,
                region: roi,
              }),
              handleClose,
            },
          ])
        },
      })
    : []
}
