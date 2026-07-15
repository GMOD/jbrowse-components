import { getConf } from '@jbrowse/core/configuration'
import { isSessionWithAddTracks } from '@jbrowse/core/util'

import { assemblyToUcscDb } from './ucscDbMap.ts'

import type {
  AbstractSessionModel,
  AbstractViewModel,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'

interface ViewWithShowTrack extends AbstractViewModel {
  showTrack: (trackId: string) => void
}

function hasShowTrack(view: AbstractViewModel): view is ViewWithShowTrack {
  return 'showTrack' in view && typeof view.showTrack === 'function'
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

// Adds a FromConfigAdapter FeatureTrack from a UCSC query result and shows it in
// an open LinearGenomeView for the assembly.
export function addResultTrack({
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
  if (view && hasShowTrack(view)) {
    view.showTrack(trackId)
  } else {
    session.notify(
      `Added track "${trackId}" but no open view displays ${assembly}`,
      'warning',
    )
  }
}
