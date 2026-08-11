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
  deleteSavedSessions: (ids: string[]) => Promise<void>
  setSavedSessionFavorite: (id: string, favorite: boolean) => Promise<void>
  renameSavedSession: (id: string, name: string) => Promise<void>
}

// The cutoffs the "delete old sessions" bulk action offers. Days, so the label
// and the filter can never disagree about what "1 week" means.
export const STALE_CUTOFFS = [
  { label: '1 day', days: 1 },
  { label: '1 week', days: 7 },
  { label: '1 month', days: 30 },
] as const

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * The sessions a bulk "delete old sessions" would remove: unfavorited, not the
 * one currently open, and last *used* — not created — longer ago than the
 * cutoff. An id survives reloads, so a session edited every day still carries
 * the createdAt of the day it was opened, and ageing by that would delete live
 * work out from under the user.
 *
 * The open session is excluded here as well as in the model's
 * deleteSavedSessions, so the count the confirmation quotes is the number of
 * sessions that will actually go.
 */
export function staleSessions(
  metadata: SessionMetadata[] | undefined,
  {
    days,
    openSessionId,
    now = Date.now(),
  }: { days: number; openSessionId?: string; now?: number },
) {
  return (metadata ?? []).filter(
    m =>
      !m.favorite &&
      m.id !== openSessionId &&
      (now - +sessionLastUsed(m)) / MS_PER_DAY > days,
  )
}
