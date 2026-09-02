import {
  containerDisplaysAssembly,
  finishAddTrack,
  getSession,
  isSessionWithPublishTrackConf,
} from '@jbrowse/core/util'
import { transaction } from 'mobx'

import { parseTrackConfigs } from './parseTrackConfigs.ts'

import type { AddTrackModel } from '../model.ts'

export async function doPasteConfigSubmit({
  model,
  jsonText,
}: {
  model: AddTrackModel
  jsonText: string
}) {
  const session = getSession(model)
  const confs = parseTrackConfigs(jsonText)

  if (!isSessionWithPublishTrackConf(session)) {
    throw new Error("Can't add tracks to this session")
  } else {
    // publishTrackConf silently returns the existing track on a trackId collision,
    // so a pasted config reusing an id would be a confusing no-op; reject it up
    // front instead.
    const existing = confs.find(conf => session.getTrackById(conf.trackId))
    if (existing) {
      throw new Error(
        `A track with trackId "${existing.trackId}" already exists; change the trackId or remove the existing track`,
      )
    }
    const { trackContainer } = model
    const notShown: string[] = []
    let added = 0
    // The configs are pasted, so nothing can resolve their display types until
    // they are in the session — the publishes stay in one transaction and the
    // shows follow it, each awaiting its display's state model.
    const toShow: string[] = []
    transaction(() => {
      for (const conf of confs) {
        // publishTrackConf returns undefined for an invalid config, which it
        // already surfaced as an error snackbar; don't show or warn about a
        // track that wasn't added.
        if (session.publishTrackConf(conf)) {
          added++
          if (
            containerDisplaysAssembly(
              trackContainer,
              conf.assemblyNames,
              session.assemblyManager,
            )
          ) {
            toShow.push(conf.trackId)
          } else {
            notShown.push(conf.name ?? conf.trackId)
          }
        }
      }
      // Only on a paste that landed something. Finishing dismisses the widget
      // and clears the form, and the pasted JSON lives in the workflow
      // component's own state, so finishing when every config was rejected
      // destroys it behind the snackbars explaining why, with nothing to retry
      // from.
      if (added > 0) {
        finishAddTrack(model, session)
      }
    })
    for (const trackId of toShow) {
      await trackContainer?.launchTrack(trackId)
    }
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
