import type { AbstractSessionModel } from '@jbrowse/core/util'

// structural copy of @jbrowse/web-core's SessionMetadata — a plugin can't
// depend on a product package, so the shape is restated here
export interface SessionMetadata {
  id: string
  name: string
  createdAt: Date
  // last autosave; absent on rows written before the field existed
  updatedAt?: Date
  configPath: string
  favorite: boolean
}

// when a session was last touched, see web-core's sessionLastUsed
export function sessionLastUsed(m: SessionMetadata) {
  return m.updatedAt ?? m.createdAt
}

export interface SessionModel extends AbstractSessionModel {
  savedSessionMetadata?: SessionMetadata[]
  activateSession: (id: string) => Promise<void>
  deleteSavedSession: (id: string) => Promise<void>
  setSavedSessionFavorite: (id: string, favorite: boolean) => Promise<void>
  renameSavedSession: (id: string, name: string) => Promise<void>
}
