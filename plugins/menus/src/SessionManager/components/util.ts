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
  activateSession: (id: string) => Promise<void>
  deleteSavedSession: (id: string) => Promise<void>
  setSavedSessionFavorite: (id: string, favorite: boolean) => Promise<void>
  renameSavedSession: (id: string, name: string) => Promise<void>
}
