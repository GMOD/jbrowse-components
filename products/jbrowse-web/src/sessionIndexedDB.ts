import { DBSchema } from 'idb'

export interface SessionDB extends DBSchema {
  savedSessions: {
    key: string
    value: { session: { name: string; [key: string]: unknown } }
  }
  autosavedSessions: {
    key: string
    value: { session: { name: string; [key: string]: unknown } }
  }
}
