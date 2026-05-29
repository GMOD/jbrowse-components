import {
  getSession,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import { transaction } from 'mobx'

import type { AddTrackModel } from '../model.ts'

interface PastedTrackConf {
  trackId: string
  assemblyNames?: string[]
}

export function doPasteConfigSubmit({
  model,
  jsonText,
}: {
  model: AddTrackModel
  jsonText: string
}) {
  const session = getSession(model)
  const parsed = JSON.parse(jsonText) as PastedTrackConf | PastedTrackConf[]
  const confs = Array.isArray(parsed) ? parsed : [parsed]

  if (isSessionWithAddTracks(session) && isSessionModelWithWidgets(session)) {
    const { view } = model
    const viewAsms = view?.assemblyNames as string[] | undefined
    transaction(() => {
      for (const conf of confs) {
        session.addTrackConf(conf)
        if (viewAsms?.some(asm => conf.assemblyNames?.includes(asm))) {
          view.showTrack?.(conf.trackId)
        }
      }
      model.clearData()
      session.hideWidget(model)
    })
  }
}
