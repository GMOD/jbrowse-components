import { fireEvent, render, screen } from '@testing-library/react'

import RecentSessionsTable from './RecentSessionsTable.tsx'

import type { RecentSessionData } from '../types.ts'

jest.mock('../../../ipc.ts', () => ({ invokeIpc: jest.fn() }))

// jsdom ships no matchMedia, and MUI's useMediaQuery answers `false` rather
// than throwing where it is missing — so without this the table takes its wide
// branch at every width and the narrow test below would pass against a
// component that has no narrow branch at all. Only `matches` is read, for the
// one px max-width query the start screen asks; the listeners are there because
// useMediaQuery subscribes before it ever reads, and nothing here resizes.
function renderAt(
  width: number,
  {
    showPath = false,
    rows = sessions,
    setSelectedPaths = () => {},
  }: {
    showPath?: boolean
    rows?: RecentSessionData[]
    setSelectedPaths?: (paths: ReadonlySet<string>) => void
  } = {},
) {
  window.matchMedia = (query: string) => {
    const px = Number(/\(max-width:\s*(\d+)px\)/.exec(query)?.[1])
    return {
      matches: width <= px,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList
  }
  return render(
    <RecentSessionsTable
      launch={async () => {}}
      sessions={rows}
      showPath={showPath}
      selectedPaths={new Set()}
      setSelectedPaths={setSelectedPaths}
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

test('a wide window gets the selection checkboxes and no path column until asked', () => {
  renderAt(1400)

  expect(screen.queryByText('Session path')).toBeNull()
  expect(
    screen.getByRole('checkbox', { name: 'Select all sessions' }),
  ).toBeTruthy()
})

test('showPath brings the path column back in a wide window', () => {
  renderAt(1400, { showPath: true })

  expect(screen.getByText('Session path')).toBeTruthy()
})

// The narrow layout spends the table's width on the name: a path column that
// fits shows "/home/u/Documents/JB…", and the checkbox column's two toolbar
// buttons are hidden at this width because every action they drive is in the
// row's own menu. Both columns coming back is what would go unnoticed — the
// table still renders, just scrolled sideways with the name unreadable.
test('a narrow window drops the path column and the selection checkboxes', () => {
  renderAt(380, { showPath: true })

  expect(screen.queryByText('Session path')).toBeNull()
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(screen.getByText('Session name')).toBeTruthy()
})

const hour = 3600e3
const dated: RecentSessionData[] = [
  { path: '/a', name: 'a', updated: Date.now() - 2 * hour, isAutosave: false },
  {
    path: '/b',
    name: 'b',
    updated: Date.now() - 30 * 24 * hour,
    isAutosave: false,
  },
  { path: '/c', name: 'c', updated: Date.now() - 5 * 60e3, isAutosave: false },
]

function shownNames() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map(row => row.textContent)
}

// the labels read "2 hours ago", "last month", "5 minutes ago", which sort
// alphabetically in none of the orders the timestamps give
test('Last modified sorts by the timestamp, not the label', () => {
  renderAt(1400, { rows: dated })

  fireEvent.click(screen.getByRole('button', { name: 'Last modified' }))
  expect(shownNames()).toEqual([
    expect.stringMatching(/^b/),
    expect.stringMatching(/^a/),
    expect.stringMatching(/^c/),
  ])

  fireEvent.click(screen.getByRole('button', { name: /Last modified/ }))
  expect(shownNames()).toEqual([
    expect.stringMatching(/^c/),
    expect.stringMatching(/^a/),
    expect.stringMatching(/^b/),
  ])
})

test('the header checkbox selects every session', () => {
  const setSelectedPaths = jest.fn()
  renderAt(1400, { rows: dated, setSelectedPaths })

  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all sessions' }))

  expect(setSelectedPaths).toHaveBeenCalledWith(new Set(['/a', '/b', '/c']))
})
