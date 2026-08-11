import {
  buildSessionListSubmenu,
  savedSessionMenuItems,
} from './sessionMenus.ts'

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

describe('savedSessionMenuItems', () => {
  function host(sessions: SessionMetadata[], currentSessionId?: string) {
    return {
      savedSessionMetadata: sessions,
      session: currentSessionId
        ? {
            id: currentSessionId,
            addWidget: () => ({}),
            showWidget: () => {},
          }
        : undefined,
      activateSession: () => Promise.resolve(),
    }
  }

  function labels(items: ReturnType<typeof savedSessionMenuItems>, i: number) {
    return items[i]!.subMenu.map(s => s.label)
  }

  // the autosave autorun restamps the open session every 400ms, so it is always
  // the newest row: left in, it is a permanently disabled entry sitting at the
  // top of the recent list and eating one of its five slots
  test('recent omits the open session', () => {
    const items = savedSessionMenuItems(
      host([meta('a', 'Session A'), meta('b', 'Session B')], 'a'),
    )
    expect(items).toHaveLength(1)
    expect(labels(items, 0)).toEqual([
      expect.stringMatching(/^Session B/),
      'More...',
    ])
  })

  // in favorites the row says something -- that the session you are in is
  // starred -- so it stays, disabled
  test('favorites keeps the open session, disabled', () => {
    const fav = { ...meta('a', 'Session A'), favorite: true }
    const items = savedSessionMenuItems(
      host([fav, meta('b', 'Session B')], 'a'),
    )
    expect(items).toHaveLength(2)
    expect(labels(items, 0)).toEqual(['Session A (current)', 'More...'])
    expect(items[0]!.subMenu[0]!.disabled).toBe(true)
  })

  test('recent still reports emptiness when the open session was the only row', () => {
    const items = savedSessionMenuItems(host([meta('a', 'Session A')], 'a'))
    expect(labels(items, 0)).toEqual(['No autosaves found'])
  })
})
