import { buildSessionListSubmenu } from './sessionMenus.ts'

import type { SessionMetadata } from '@jbrowse/web-core'

function meta(id: string, name: string): SessionMetadata {
  return { id, name, createdAt: new Date(), configPath: '', favorite: false }
}

const noopActions = {
  activate: () => Promise.resolve(),
  showMore: () => {},
}

test('empty sessions with an emptyLabel yields a single disabled-style entry', () => {
  const items = buildSessionListSubmenu({
    sessions: [],
    currentSessionId: undefined,
    actions: noopActions,
    emptyLabel: 'No autosaves found',
  })
  expect(items).toHaveLength(1)
  expect(items[0]!.label).toBe('No autosaves found')
})

test('empty sessions without an emptyLabel yields nothing', () => {
  expect(
    buildSessionListSubmenu({
      sessions: [],
      currentSessionId: undefined,
      actions: noopActions,
    }),
  ).toHaveLength(0)
})

test('undefined sessions yields nothing', () => {
  expect(
    buildSessionListSubmenu({
      sessions: undefined,
      currentSessionId: undefined,
      actions: noopActions,
    }),
  ).toHaveLength(0)
})

test('lists sessions and appends a More... entry', () => {
  const items = buildSessionListSubmenu({
    sessions: [meta('a', 'Session A'), meta('b', 'Session B')],
    currentSessionId: undefined,
    actions: noopActions,
  })
  expect(items).toHaveLength(3)
  expect(items[0]!.label).toMatch(/^Session A/)
  expect(items[2]!.label).toBe('More...')
})

test('marks the current session as disabled and labels it current', () => {
  const items = buildSessionListSubmenu({
    sessions: [meta('a', 'Session A'), meta('b', 'Session B')],
    currentSessionId: 'a',
    actions: noopActions,
  })
  expect(items[0]!.disabled).toBe(true)
  expect(items[0]!.label).toBe('Session A (current)')
  expect(items[1]!.disabled).toBeFalsy()
})

test('clicking an item activates it and More opens the manager', () => {
  const activate = jest.fn(() => Promise.resolve())
  const showMore = jest.fn()
  const items = buildSessionListSubmenu({
    sessions: [meta('a', 'Session A')],
    currentSessionId: undefined,
    actions: { activate, showMore },
  })
  items[0]!.onClick()
  expect(activate).toHaveBeenCalledWith('a')
  items[1]!.onClick()
  expect(showMore).toHaveBeenCalledTimes(1)
})
