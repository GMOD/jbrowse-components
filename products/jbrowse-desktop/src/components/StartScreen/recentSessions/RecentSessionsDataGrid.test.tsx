import { render, screen } from '@testing-library/react'

import RecentSessionsDataGrid from './RecentSessionsDataGrid.tsx'

import type { RecentSessionData } from '../types.ts'

jest.mock('../../../ipc.ts', () => ({ invokeIpc: jest.fn() }))

// jsdom ships no matchMedia, and MUI's useMediaQuery answers `false` rather
// than throwing where it is missing — so without this the grid takes its wide
// branch at every width and the narrow test below would pass against a
// component that has no narrow branch at all. Only `matches` is read, for the
// one px max-width query the start screen asks; the listeners are there because
// useMediaQuery subscribes before it ever reads, and nothing here resizes.
function renderAt(width: number) {
  window.matchMedia = (query: string) => {
    const px = Number(/\(max-width:\s*(\d+)px\)/.exec(query)?.[1])
    return {
      matches: width <= px,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList
  }
  return render(
    <RecentSessionsDataGrid
      launch={async () => {}}
      sessions={sessions}
      setSelectedSessions={() => {}}
      setSessionToRename={() => {}}
      setSessionsToDelete={() => {}}
      isFavorite={() => false}
      toggleFavorite={() => {}}
    />,
  )
}

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia')
})

const sessions: RecentSessionData[] = [
  {
    path: '/home/u/Documents/JBrowse/hg38-gencode.jbrowse',
    name: 'Human hg38 GENCODE annotations',
    updated: Date.now() - 3600e3,
    isAutosave: false,
  },
]

test('a wide window gets the path column and the selection checkboxes', () => {
  const { container } = renderAt(1400)

  expect(screen.getByText('Session path')).toBeTruthy()
  expect(container.querySelector('[data-field="__check__"]')).not.toBeNull()
})

// The narrow layout spends the grid's width on the name: a path column that
// fits shows "/home/u/Documents/JB…", and the checkbox column's two toolbar
// buttons are hidden at this width because every action they drive is in the
// row's own menu. Both columns coming back is what would go unnoticed — the
// grid still renders, just scrolled sideways with the name unreadable.
test('a narrow window drops the path column and the selection checkboxes', () => {
  const { container } = renderAt(380)

  expect(screen.queryByText('Session path')).toBeNull()
  expect(container.querySelector('[data-field="__check__"]')).toBeNull()
  expect(screen.getByText('Session name')).toBeTruthy()
})
