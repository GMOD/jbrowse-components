import { nextSessionMetadata } from './sessionDbOps.ts'

import type { SessionMetadata } from './types.ts'

const snap = { id: 'abc', name: 'My session' }
const ident = {
  id: 'abc',
  name: 'My session',
  configPath: 'config.json',
  edited: true,
}

function existing(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
  return {
    id: 'abc',
    name: 'Old name',
    createdAt: new Date('2020-01-01'),
    updatedAt: new Date('2020-06-01'),
    configPath: 'config.json',
    favorite: false,
    ...overrides,
  }
}

// The star lives only in this row, so every autosave tick rewrites it. When
// this regresses, favoriting the open session appears to work and then quietly
// undoes itself 400ms later.
it('carries a favorite over from the row it replaces', () => {
  expect(
    nextSessionMetadata(existing({ favorite: true }), snap, ident).favorite,
  ).toBe(true)
  expect(nextSessionMetadata(existing(), snap, ident).favorite).toBe(false)
})

it('carries a thumbnail over from the row it replaces', () => {
  const thumbnail = 'data:image/webp;base64,AAAA'
  expect(
    nextSessionMetadata(existing({ thumbnail }), snap, ident).thumbnail,
  ).toBe(thumbnail)
})

it('defaults favorite to false for a session with no row yet', () => {
  expect(nextSessionMetadata(undefined, snap, ident).favorite).toBe(false)
})

// A session id survives reloads, so createdAt must keep pointing at the day the
// session first appeared — otherwise every autosave makes the session look
// brand new, and the recent list and pruner both rank by the wrong date.
it('pins createdAt to the existing row and moves updatedAt forward', () => {
  const prev = existing()
  const meta = nextSessionMetadata(prev, snap, ident)
  expect(meta.createdAt).toEqual(prev.createdAt)
  expect(+meta.updatedAt!).toBeGreaterThan(+prev.updatedAt!)
})

it('stamps createdAt and updatedAt together for a brand new row', () => {
  const meta = nextSessionMetadata(undefined, snap, ident)
  expect(meta.createdAt).toEqual(meta.updatedAt)
})

it('takes name/id/configPath from the caller, not the old row', () => {
  const meta = nextSessionMetadata(
    existing({ name: 'Old name', configPath: 'other.json' }),
    snap,
    ident,
  )
  expect(meta).toMatchObject({
    id: 'abc',
    name: 'My session',
    configPath: 'config.json',
  })
})

// A row written only as the session booted stays unlisted until an edit, and
// an edit is never taken back by a later boot-state write
it('marks a row edited for good once any write is of a change', () => {
  const boot = { ...ident, edited: false }
  expect(nextSessionMetadata(undefined, snap, boot).edited).toBe(false)
  expect(
    nextSessionMetadata(existing({ edited: false }), snap, boot).edited,
  ).toBe(false)
  expect(
    nextSessionMetadata(existing({ edited: true }), snap, boot).edited,
  ).toBe(true)
  expect(nextSessionMetadata(existing(), snap, boot).edited).toBe(true)
  expect(
    nextSessionMetadata(existing({ edited: false }), snap, ident).edited,
  ).toBe(true)
})
