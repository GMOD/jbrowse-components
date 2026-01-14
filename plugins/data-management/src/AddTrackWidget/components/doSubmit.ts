import {
  getSession,
  isElectron,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
  isSupportedIndexingAdapter,
} from '@jbrowse/core/util'
import { getRoot } from '@jbrowse/mobx-state-tree'

import type { AddTrackModel } from '../model.ts'

function doTextIndexTrack({
  trackId,
  model,
}: {
  trackId: string
  model: AddTrackModel
}) {
  const { textIndexingConf, trackName, assembly } = model
  const { jobsManager } = getRoot<any>(model)
  const attr = textIndexingConf || {
    attributes: ['Name', 'ID'],
    exclude: ['CDS', 'exon'],
  }
  const indexName = `${trackName}-index`
  jobsManager.queueJob({
    indexingParams: {
      ...attr,
      assemblies: [assembly],
      tracks: [trackId],
      indexType: 'perTrack',
      name: indexName,
      timestamp: new Date().toISOString(),
    },
    name: indexName,
    cancelCallback: () => jobsManager.abortJob(),
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
    view?.showTrack?.(trackId)

    if (
      isElectron &&
      textIndexTrack &&
      isSupportedIndexingAdapter(trackAdapter.type)
    ) {
      doTextIndexTrack({
        model,
        trackId,
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
