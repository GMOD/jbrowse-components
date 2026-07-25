import { getConf } from '@jbrowse/core/configuration'
import { isSessionWithAddTracks } from '@jbrowse/core/util'

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

// jb2hubs stamps the UCSC db on the assembly's sequence.metadata; prefer that
// explicit value, falling back to the static alias map for assemblies whose
// configs predate the stamp. Shared by the BLAT and in-silico PCR dialogs.
export function resolveUcscDb(session: AbstractSessionModel, name: string) {
  const assembly = session.assemblyManager.get(name)
  const stamped: string | undefined = assembly
    ? getConf(assembly, ['sequence', 'metadata', 'blatDb'])
    : undefined
  return stamped ? stamped : assemblyToUcscDb(name)
}

// Builds a locstring from a feature. Feature coordinates are interbase, so the
// start needs +1 to become the 1-based coordinate a locstring names.
export function featureLocString(feature: SimpleFeatureSerialized) {
  return `${feature.refName}:${feature.start + 1}-${feature.end}`
}

// Turns a UCSC query result into an on-the-fly FromConfigAdapter FeatureTrack,
// shows it, and navigates to the leading hit. Answering "where is this sequence"
// is the point of the query, so landing on the coordinates is part of the
// result rather than a follow-up the user has to perform. Callers pass
// `features` best-first (pslToFeatures sorts by score; hgPcr returns its
// products in order).
export async function addResultTrack({
  session,
  assembly,
  features,
  trackIdPrefix,
  trackName,
}: {
  session: AbstractSessionModel
  assembly: string
  features: SimpleFeatureSerialized[]
  trackIdPrefix: string
  trackName: string
}) {
  if (!isSessionWithAddTracks(session)) {
    throw new Error("Can't add tracks to this session")
  }
  const trackId = `${trackIdPrefix}-${Date.now()}`
  session.addTrackConf({
    type: 'FeatureTrack',
    trackId,
    name: trackName,
    assemblyNames: [assembly],
    adapter: {
      type: 'FromConfigAdapter',
      features,
    },
  })
  const view = session.views.find(
    v => v.type === 'LinearGenomeView' && !!v.assemblyNames?.includes(assembly),
  )
  if (view && isNavigableView(view)) {
    view.showTrack(trackId)
    const loc = featureLocString(features[0]!)
    try {
      // grow so the hit sits inside the viewport with flanking context rather
      // than filling it edge to edge
      await view.navToLocString(loc, assembly, 0.2)
      session.notify(
        features.length > 1
          ? `${features.length} hits; showing the best at ${loc}`
          : `1 hit at ${loc}`,
        'success',
      )
    } catch (e) {
      // a hit on a refName the loaded assembly doesn't know (the UCSC db and
      // the loaded assembly aren't the same build, or lack an alias) still
      // belongs in the track — report the coordinates rather than dropping them
      session.notify(
        `${features.length} hit(s) added, but could not navigate to ${loc}: ${e}`,
        'warning',
      )
    }
  } else {
    session.notify(
      `Added track "${trackId}" but no open view displays ${assembly}`,
      'warning',
    )
  }
}
