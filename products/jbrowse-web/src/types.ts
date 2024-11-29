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
    createdAt: Date
    value: SavedSession
  }
  autosavedSessions: {
    key: string
    createdAt: Date
    value: SavedSession
  }
}
