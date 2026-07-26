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
  return region
    ? oneOrManyMenuItem({
        label,
        icon: CompareArrowsIcon,
        entries: launchableTracks(session, region.assemblyName),
        entryLabel: track => track.name,
        onSelect: track => () => {
          session.queueDialog(handleClose => [
            LaunchSyntenyViewForRegionDialog,
            {
              session,
              region,
              track: { trackId: track.trackId, name: track.name },
              discoverMates: makeMateDiscovery({
                session,
                track: track.conf,
                region,
              }),
              handleClose,
            },
          ])
        },
      })
    : []
}
