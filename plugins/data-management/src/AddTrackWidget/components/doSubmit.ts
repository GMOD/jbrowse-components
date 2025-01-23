import {
  getSession,
  isElectron,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
  isSupportedIndexingAdapter,
} from '@jbrowse/core/util'
import { getRoot } from 'mobx-state-tree'

import type { AddTrackModel } from '../model'

function doTextIndexTrack({ model }: { model: AddTrackModel }) {
  const { textIndexingConf, trackId, trackName, assembly } = model
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
  const { textIndexTrack, trackConfig, trackAdapter, view } = model
  const session = getSession(model)

  if (!isSessionWithAddTracks(session)) {
    throw new Error("Can't add tracks to this session")
  } else if (trackConfig && trackAdapter) {
    session.addTrackConf(trackConfig)
    view?.showTrack?.(trackConfig.trackId)

    if (
      isElectron &&
      textIndexTrack &&
      isSupportedIndexingAdapter(trackAdapter.type)
    ) {
      doTextIndexTrack({ model })
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
