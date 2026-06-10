import {
  getSession,
  isElectron,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
  isSupportedIndexingAdapter,
} from '@jbrowse/core/util'
import { getRoot } from '@jbrowse/mobx-state-tree'

import { defaultIndexingConf } from './util.ts'

import type { AddTrackModel } from '../model.ts'

interface RootWithJobsManager {
  jobsManager: {
    queueJob: (job: unknown) => void
  }
}

function doTextIndexTrack({
  trackId,
  model,
}: {
  trackId: string
  model: AddTrackModel
}) {
  const { textIndexingConf, assembly } = model
  const { jobsManager } = getRoot<RootWithJobsManager>(model)
  const attr = textIndexingConf ?? defaultIndexingConf
  jobsManager.queueJob({
    indexingParams: {
      ...attr,
      assemblies: [assembly],
      tracks: [trackId],
      indexType: 'perTrack',
      name: trackId,
      timestamp: new Date().toISOString(),
    },
    // jobs are keyed by name; trackId is unique so two tracks sharing a
    // display name won't collide
    name: trackId,
  })
}

export function doSubmit({ model }: { model: AddTrackModel }) {
  const { textIndexTrack, trackAdapter, view } = model
  const session = getSession(model)
  const trackConfig = model.getTrackConfig(Date.now())

  if (!isSessionWithAddTracks(session)) {
    throw new Error("Can't add tracks to this session")
  } else if (trackConfig && trackAdapter) {
    const { trackId } = trackConfig
    session.addTrackConf(trackConfig)
    if (view?.assemblyNames?.includes(model.assembly)) {
      view.showTrack(trackId)
    } else {
      // The track was added to the session but can't be shown here because its
      // assembly isn't open in this view (common when the assembly dropdown is
      // changed in a multi-assembly session). Tell the user instead of silently
      // doing nothing.
      session.notify(
        `Added track "${model.trackName}" to the session, but it was not displayed because it uses assembly "${model.assembly}", which is not open in this view. Open a view for that assembly and use its track selector to display it.`,
        'warning',
      )
    }

    if (
      isElectron &&
      textIndexTrack &&
      isSupportedIndexingAdapter(trackAdapter.type)
    ) {
      doTextIndexTrack({
        model,
        trackId: String(trackId),
      })
    }
    model.clearData()
    if (isSessionModelWithWidgets(session)) {
      session.hideWidget(model)
    }
  } else {
    throw new Error(
      'Failed to add track.\nThe configuration of this file is not currently supported.',
    )
  }
}
