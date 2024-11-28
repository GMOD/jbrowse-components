import type { DBSchema } from 'idb'

export interface Session {
  name: string
  [key: string]: unknown
}
export interface SavedSession {
  session: Session
}
export interface SessionDB extends DBSchema {
  savedSessions: {
    key: string
    value: SavedSession
  }
  autosavedSessions: {
    key: string
    value: SavedSession
  }
}
