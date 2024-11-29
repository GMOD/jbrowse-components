import type { DBSchema } from 'idb'

export interface Session {
  name: string
  [key: string]: unknown
}
export interface SavedSession {
  session: Session
  createdAt: Date
}
export interface SessionDB extends DBSchema {
  savedSessions: {
    key: string
    value: SavedSession
  }
}
