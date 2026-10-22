import {
  addTracksFromWidget,
  getSession,
  isSessionWithPublishTrackConf,
} from '@jbrowse/core/util'

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
  }
  // publishTrackConf silently returns the existing track on a trackId
  // collision, so a pasted config reusing an id would be a confusing no-op
  const existing = confs.find(conf => session.getTrackById(conf.trackId))
  if (existing) {
    throw new Error(
      `A track with trackId "${existing.trackId}" already exists; change the trackId or remove the existing track`,
    )
  }
  await addTracksFromWidget({ model, session, confs }).shown
}
