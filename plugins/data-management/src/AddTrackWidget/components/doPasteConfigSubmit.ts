import {
  getSession,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import { transaction } from 'mobx'

import { parseTrackConfigs } from './parseTrackConfigs.ts'
import { viewDisplaysAssembly } from './util.ts'

import type { AddTrackModel } from '../model.ts'

export function doPasteConfigSubmit({
  model,
  jsonText,
}: {
  model: AddTrackModel
  jsonText: string
}) {
  const session = getSession(model)
  const confs = parseTrackConfigs(jsonText)

  if (!isSessionWithAddTracks(session)) {
    throw new Error("Can't add tracks to this session")
  } else {
    // addTrackConf silently returns the existing track on a trackId collision,
    // so a pasted config reusing an id would be a confusing no-op; reject it up
    // front instead.
    const existing = confs.find(conf => session.tracksById[conf.trackId])
    if (existing) {
      throw new Error(
        `A track with trackId "${existing.trackId}" already exists; change the trackId or remove the existing track`,
      )
    }
    const { view } = model
    const notShown: string[] = []
    transaction(() => {
      for (const conf of confs) {
        // addTrackConf returns undefined for an invalid config, which it
        // already surfaced as an error snackbar; don't show or warn about a
        // track that wasn't added.
        if (session.addTrackConf(conf)) {
          if (viewDisplaysAssembly(view, conf.assemblyNames)) {
            view?.showTrack?.(conf.trackId)
          } else {
            notShown.push(conf.name ?? conf.trackId)
          }
        }
      }
      model.clearData()
      if (isSessionModelWithWidgets(session)) {
        session.hideWidget(model)
      }
    })
    if (notShown.length) {
      // These tracks were added to the session but can't be shown here because
      // their assembly isn't open in this view; surface that rather than
      // silently doing nothing.
      session.notify(
        `Added ${notShown.length} track(s) to the session that were not displayed because their assembly is not open in this view: ${notShown.join(', ')}`,
        'warning',
      )
    }
  }
}
