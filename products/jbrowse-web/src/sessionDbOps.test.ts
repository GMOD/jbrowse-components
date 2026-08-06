import { nextSessionMetadata } from './sessionDbOps.ts'

import type { SessionMetadata } from './types.ts'

const ident = { id: 'abc', name: 'My session', configPath: 'config.json' }

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
    nextSessionMetadata(existing({ favorite: true }), ident).favorite,
  ).toBe(true)
  expect(nextSessionMetadata(existing(), ident).favorite).toBe(false)
})

it('defaults favorite to false for a session with no row yet', () => {
  expect(nextSessionMetadata(undefined, ident).favorite).toBe(false)
})

// A session id survives reloads, so createdAt must keep pointing at the day the
// session first appeared — otherwise every autosave makes the session look
// brand new, and the recent list and pruner both rank by the wrong date.
it('pins createdAt to the existing row and moves updatedAt forward', () => {
  const prev = existing()
  const meta = nextSessionMetadata(prev, ident)
  expect(meta.createdAt).toEqual(prev.createdAt)
  expect(+meta.updatedAt!).toBeGreaterThan(+prev.updatedAt!)
})

it('stamps createdAt and updatedAt together for a brand new row', () => {
  const meta = nextSessionMetadata(undefined, ident)
  expect(meta.createdAt).toEqual(meta.updatedAt)
})

it('takes name/id/configPath from the caller, not the old row', () => {
  const meta = nextSessionMetadata(
    existing({ name: 'Old name', configPath: 'other.json' }),
    ident,
  )
  expect(meta).toMatchObject({
    id: 'abc',
    name: 'My session',
    configPath: 'config.json',
  })
})
