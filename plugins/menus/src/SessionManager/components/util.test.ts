import { staleSessions } from './util.ts'

import type { SessionMetadata } from './util.ts'

const now = +new Date('2024-06-30T12:00:00Z')

function daysAgo(days: number) {
  return new Date(now - days * 24 * 60 * 60 * 1000)
}

function meta(
  over: Partial<SessionMetadata> & { id: string },
): SessionMetadata {
  return {
    name: over.id,
    configPath: '',
    favorite: false,
    createdAt: daysAgo(365),
    updatedAt: daysAgo(365),
    ...over,
  }
}

const ids = (m: SessionMetadata[]) => m.map(x => x.id)

it('matches only sessions past the cutoff', () => {
  const list = [
    meta({ id: 'hours', updatedAt: daysAgo(0.5) }),
    meta({ id: 'twoDays', updatedAt: daysAgo(2) }),
    meta({ id: 'twoWeeks', updatedAt: daysAgo(14) }),
  ]
  expect(ids(staleSessions(list, { days: 1, now }))).toEqual([
    'twoDays',
    'twoWeeks',
  ])
  expect(ids(staleSessions(list, { days: 7, now }))).toEqual(['twoWeeks'])
  expect(ids(staleSessions(list, { days: 30, now }))).toEqual([])
})

// what a user starred is what they asked to keep, however old it is
it('never matches a favorite', () => {
  const list = [meta({ id: 'old', favorite: true })]
  expect(staleSessions(list, { days: 1, now })).toEqual([])
})

// the model refuses to delete the open session, so counting it would make the
// confirmation quote a number larger than what actually goes
it('never matches the open session', () => {
  const list = [meta({ id: 'open' }), meta({ id: 'other' })]
  expect(
    ids(staleSessions(list, { days: 1, now, openSessionId: 'open' })),
  ).toEqual(['other'])
})

// ages by last use, not creation: an id survives reloads, so a session edited
// every day still carries the createdAt of the day it was opened
it('ages a long-lived session by its last use, not its creation', () => {
  const list = [
    meta({ id: 'live', createdAt: daysAgo(365), updatedAt: new Date(now) }),
  ]
  expect(staleSessions(list, { days: 1, now })).toEqual([])
})

// rows written before updatedAt existed fall back to createdAt via
// sessionLastUsed; reading updatedAt directly would compare against undefined
it('ages a legacy row with no updatedAt by createdAt', () => {
  const recent = meta({ id: 'legacyRecent', createdAt: daysAgo(0.5) })
  const old = meta({ id: 'legacyOld', createdAt: daysAgo(9) })
  delete recent.updatedAt
  delete old.updatedAt
  expect(ids(staleSessions([recent, old], { days: 1, now }))).toEqual([
    'legacyOld',
  ])
})

it('treats a list that has not loaded as matching nothing', () => {
  expect(staleSessions(undefined, { days: 1, now })).toEqual([])
})
