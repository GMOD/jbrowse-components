import {
  getSession,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import { transaction } from 'mobx'

import { parseTrackConfigs } from './parseTrackConfigs.ts'

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
    const { view } = model
    const viewAsms = view?.assemblyNames as string[] | undefined
    const notShown: string[] = []
    transaction(() => {
      for (const conf of confs) {
        session.addTrackConf(conf)
        if (viewAsms?.some(asm => conf.assemblyNames?.includes(asm))) {
          view?.showTrack?.(conf.trackId)
        } else {
          notShown.push(conf.name ?? conf.trackId)
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
