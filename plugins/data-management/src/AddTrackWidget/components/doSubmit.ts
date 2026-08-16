import {
  addTrackFromWidget,
  getSession,
  isElectron,
  isSupportedIndexingAdapter,
} from '@jbrowse/core/util'
import { getRoot } from '@jbrowse/mobx-state-tree'

import { defaultIndexingConf } from './util.ts'

import type { AddTrackModel, IndexingAttr } from '../model.ts'

interface RootWithJobsManager {
  jobsManager: {
    queueJob: (job: unknown) => void
  }
}

function doTextIndexTrack({
  trackId,
  timestamp,
  model,
  assembly,
  attr,
}: {
  trackId: string
  timestamp: number
  model: AddTrackModel
  assembly: string | undefined
  attr: IndexingAttr
}) {
  const { jobsManager } = getRoot<RootWithJobsManager>(model)
  jobsManager.queueJob({
    indexingParams: {
      ...attr,
      assemblies: [assembly],
      tracks: [trackId],
      indexType: 'perTrack',
      name: trackId,
      timestamp: new Date(timestamp).toISOString(),
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
  const wantsIndex =
    isElectron &&
    textIndexTrack &&
    isSupportedIndexingAdapter(trackAdapter.type)

  // Coerced even though `DraftTrackConfig` types this `string`: `mixinData` is
  // a plugin extension point and deepmerge lets it write any key, so the
  // declared shape is what the widget builds rather than a guarantee about what
  // survives the merge. Nothing in-tree contributes a `trackId` — the four
  // comparative components and GWAS all contribute `adapter`/`assemblyNames` —
  // so this only ever normalizes a third-party one.
  const trackId = String(trackConfig.trackId)
  if (addTrackFromWidget({ model, session, conf: trackConfig }) && wantsIndex) {
    doTextIndexTrack({ model, trackId, timestamp, assembly, attr })
  }
}
