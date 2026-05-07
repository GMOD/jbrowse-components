import type { AbstractSessionModel } from '@jbrowse/core/util'

export interface SessionMetadata {
  id: string
  name: string
  createdAt: Date
  configPath: string
  favorite: boolean
}

export interface SessionModel extends AbstractSessionModel {
  savedSessionMetadata?: SessionMetadata[]
  activateSession: (id: string) => void
  deleteSavedSession: (id: string) => void
  setSavedSessionFavorite: (id: string, favorite: boolean) => void
}
