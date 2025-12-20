import type { AbstractSessionModel } from '@jbrowse/core/util'

export interface SessionMetadata {
  id: string
  name: string
  createdAt: Date
  configPath: string
  favorite: boolean
}

export interface SessionSnap {
  createdAt: Date
  session: {
    name: string
    id: string
    views?: { tracks?: unknown[] }[]
    [key: string]: unknown
  }
}

export interface SessionModel extends AbstractSessionModel {
  savedSessionMetadata?: SessionMetadata[]
  removeSavedSession: (arg: SessionSnap) => void
  activateSession: (arg: string) => void
  loadAutosaveSession: () => void
  previousAutosaveId: string
}
