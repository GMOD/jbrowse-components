import type { AbstractSessionModel } from '@jbrowse/core/util'

export interface SessionSnap {
  name: string
  views?: { tracks?: unknown[] }[]
  [key: string]: unknown
}

export interface SessionModel extends AbstractSessionModel {
  savedSessions: SessionSnap[]
  removeSavedSession: (arg: SessionSnap) => void
  activateSession: (arg: string) => void
  loadAutosaveSession: () => void
  previousAutosaveId: string
}
