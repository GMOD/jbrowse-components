import {
  getSession,
  isElectron,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
  isSupportedIndexingAdapter,
} from '@jbrowse/core/util'
import { getRoot } from 'mobx-state-tree'

import type { AddTrackModel } from '../model'

export function doSubmit({ model }: { model: AddTrackModel }) {
  const {
    textIndexingConf,
    textIndexTrack,
    trackConfig,
    trackId,
    trackAdapter,
    trackName,
    assembly,
    view,
  } = model
  const session = getSession(model)

  if (!isSessionWithAddTracks(session)) {
    throw new Error("Can't add tracks to this session")
  } else if (trackConfig && trackAdapter) {
    session.addTrackConf(trackConfig)
    view?.showTrack?.(trackId)

    if (
      isElectron &&
      textIndexTrack &&
      isSupportedIndexingAdapter(trackAdapter.type)
    ) {
      const { jobsManager } = getRoot<any>(model)
      const attr = textIndexingConf || {
        attributes: ['Name', 'ID'],
        exclude: ['CDS', 'exon'],
      }
      const indexName = `${trackName}-index`
      const newEntry = {
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
      }
      jobsManager.queueJob(newEntry)
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
