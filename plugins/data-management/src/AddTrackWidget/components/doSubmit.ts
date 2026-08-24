import {
  addTrackFromWidget,
  getSession,
  isElectron,
  isSupportedIndexingAdapter,
  namesTemporaryAssembly,
} from '@jbrowse/core/util'
import { getRoot } from '@jbrowse/mobx-state-tree'

import { defaultIndexingConf } from './util.ts'

import type { AddTrackModel, IndexingAttr } from '../model.ts'

// structural, because the desktop root model this reaches is in a product the
// plugin can't import. Spelled out rather than `unknown`: it typed the
// assemblies array as `(string | undefined)[]`, which the indexer would have
// written into a textSearchAdapter conf no search could ever match
interface RootWithJobsManager {
  jobsManager: {
    queueJob: (job: {
      name: string
      indexingParams: IndexingAttr & {
        assemblies: string[]
        tracks: string[]
        indexType: 'perTrack' | 'aggregate'
      }
    }) => void
  }
}

function doTextIndexTrack({
  trackId,
  model,
  assembly,
  attr,
}: {
  trackId: string
  model: AddTrackModel
  assembly: string
  attr: IndexingAttr
}) {
  const { jobsManager } = getRoot<RootWithJobsManager>(model)
  jobsManager.queueJob({
    indexingParams: {
      ...attr,
      assemblies: [assembly],
      tracks: [trackId],
      indexType: 'perTrack',
    },
    // jobs are keyed by name; trackId is unique so two tracks sharing a
    // display name won't collide
    name: trackId,
  })
}

export function doSubmit({ model }: { model: AddTrackModel }) {
  const { textIndexTrack, trackAdapter } = model
  const session = getSession(model)
  const timestamp = Date.now()
  const trackConfig = model.getTrackConfig(timestamp)

  if (!trackConfig || !trackAdapter) {
    throw new Error(
      'Failed to add track.\nThe configuration of this file is not currently supported.',
    )
  }

  // read before the add, which clears the form on success
  const assembly = model.assembly
  const attr = model.textIndexingConf ?? defaultIndexingConf
  // Never for a track on an assembly the view synthesized: `addTrackFromWidget`
  // opens that one inline on the track rather than adding it to any list, so an
  // indexing job would name a trackId the config does not hold, and the index
  // would outlive the track it was built for by the width of the session.
  // `assembly !== undefined` is already implied by trackConfig existing —
  // getTrackConfig returns undefined without a resolvable assembly — but stated
  // here it is what narrows `assembly` for doTextIndexTrack
  const wantsIndex =
    isElectron &&
    textIndexTrack &&
    assembly !== undefined &&
    isSupportedIndexingAdapter(trackAdapter.type) &&
    !namesTemporaryAssembly(session, trackConfig)

  // Coerced even though `DraftTrackConfig` types this `string`: `mixinData` is
  // a plugin extension point and the merge lets it write any key, so the
  // declared shape is what the widget builds rather than a guarantee about what
  // survives the merge. Nothing in-tree contributes a `trackId` — the four
  // comparative components and GWAS all contribute `adapter`/`assemblyNames` —
  // so this only ever normalizes a third-party one.
  const trackId = String(trackConfig.trackId)
  if (addTrackFromWidget({ model, session, conf: trackConfig }) && wantsIndex) {
    doTextIndexTrack({ model, trackId, assembly, attr })
  }
}
