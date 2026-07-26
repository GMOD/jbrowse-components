import { getConf } from '@jbrowse/core/configuration'
import {
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'

import { assemblyToUcscDb } from './ucscDbMap.ts'

import type {
  AbstractSessionModel,
  AbstractViewModel,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'

interface NavigableView extends AbstractViewModel {
  showTrack: (trackId: string) => void
  navToLocString: (
    locString: string,
    assemblyName?: string,
    grow?: number,
  ) => Promise<void>
}

function isNavigableView(view: AbstractViewModel): view is NavigableView {
  return (
    'showTrack' in view &&
    typeof view.showTrack === 'function' &&
    'navToLocString' in view &&
    typeof view.navToLocString === 'function'
  )
}

// jb2hubs stamps the UCSC db on the assembly's sequence.metadata. Its presence
// is also the one positive proof that UCSC can search the assembly, so the
// dialogs read it directly to decide whether to warn.
export function ucscDbStamp(session: AbstractSessionModel, name: string) {
  const assembly = session.assemblyManager.get(name)
  const stamped: string | undefined = assembly
    ? getConf(assembly, ['sequence', 'metadata', 'blatDb'])
    : undefined
  return stamped
}

// Prefers the stamp, falling back to the static alias map for assemblies whose
// configs predate it. Shared by the BLAT and in-silico PCR dialogs.
export function resolveUcscDb(session: AbstractSessionModel, name: string) {
  const stamped = ucscDbStamp(session, name)
  return stamped ? stamped : assemblyToUcscDb(name)
}

// Builds a locstring from a feature. Feature coordinates are interbase, so the
// start needs +1 to become the 1-based coordinate a locstring names.
export function featureLocString(feature: SimpleFeatureSerialized) {
  return `${feature.refName}:${feature.start + 1}-${feature.end}`
}

function findNavigableView(session: AbstractSessionModel, assembly: string) {
  const view = session.views.find(
    v => v.type === 'LinearGenomeView' && !!v.assemblyNames?.includes(assembly),
  )
  return view && isNavigableView(view) ? view : undefined
}

// Navigates an open view to a hit, growing the window so it lands with flanking
// context rather than filling the viewport edge to edge. Shared by the
// post-query navigation and the results widget's per-hit links.
export async function navToFeature(
  session: AbstractSessionModel,
  assembly: string,
  feature: SimpleFeatureSerialized,
) {
  const view = findNavigableView(session, assembly)
  const loc = featureLocString(feature)
  if (view) {
    try {
      await view.navToLocString(loc, assembly, 0.2)
    } catch (e) {
      // a hit on a refName the loaded assembly doesn't know (the UCSC db and
      // the loaded assembly aren't the same build, or lack an alias) still
      // belongs in the track — report the coordinates rather than dropping them
      session.notify(`Could not navigate to ${loc}: ${e}`, 'warning')
    }
  } else {
    session.notify(`No open view displays ${assembly}`, 'warning')
  }
}

// How a result set is displayed. Defaults to an on-the-fly FromConfigAdapter
// FeatureTrack, which is all an hgPcr product needs; a BLAT hit overrides it
// with a SAM alignment so its blocks, indels and per-base mismatches are drawn.
// `displayDefaults` is the shorthand for slots on that track's default display.
export interface ResultTrackConf {
  type: string
  adapter: Record<string, unknown>
  displayDefaults?: Record<string, unknown>
}

// Turns a UCSC query result into an on-the-fly track, shows it, navigates to the
// leading hit, and opens the hit list in the drawer. Answering "where is this
// sequence" is the point of the query, so landing on the coordinates is part of
// the result rather than a follow-up the user has to perform — and the widget
// keeps the rest of the hits readable after the dialog closes, which a snackbar
// naming only the best one could not. Callers pass `features` best-first
// (pslToFeatures sorts by score; hgPcr returns its products in order).
export async function addResultTrack({
  session,
  assembly,
  features,
  trackIdPrefix,
  trackName,
  trackConf,
}: {
  session: AbstractSessionModel
  assembly: string
  features: SimpleFeatureSerialized[]
  trackIdPrefix: string
  trackName: string
  trackConf?: ResultTrackConf
}) {
  if (!isSessionWithAddTracks(session)) {
    throw new Error("Can't add tracks to this session")
  }
  const trackId = `${trackIdPrefix}-${Date.now()}`
  const resultTrack = trackConf ?? {
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features },
  }
  session.addTrackConf({
    ...resultTrack,
    trackId,
    name: trackName,
    assemblyNames: [assembly],
  })
  const view = findNavigableView(session, assembly)
  if (view) {
    view.showTrack(trackId)
    await navToFeature(session, assembly, features[0]!)
  } else {
    // navToFeature would say the same thing less usefully, so it is skipped
    // rather than left to report the missing view a second time
    session.notify(
      `Added track "${trackId}" but no open view displays ${assembly}`,
      'warning',
    )
  }
  if (isSessionModelWithWidgets(session)) {
    session.showWidget(
      session.addWidget('UcscResultsWidget', 'ucscResults', {
        features,
        assembly,
        trackName,
      }),
    )
  }
}
