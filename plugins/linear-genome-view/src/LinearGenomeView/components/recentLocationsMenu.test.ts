import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

import { recentLocationOf, recentLocationsMenu } from './recentLocationsMenu.ts'

import type { MenuItem, RecentLocation } from '@jbrowse/core/ui'

// pull the navigable rows out of the built submenu (everything before the
// divider that precedes "Clear recent locations")
function rows(items: MenuItem[]) {
  const submenu = (items[0] as { subMenu: MenuItem[] }).subMenu
  return submenu.slice(0, -2) as { label: string; onClick: () => void }[]
}

function replay(recentLocations: RecentLocation[]) {
  const navigated: BaseResult[] = []
  const items = recentLocationsMenu({
    recentLocations,
    onNavigate: option => {
      navigated.push(option)
    },
    onClear: () => {},
  })
  for (const r of rows(items)) {
    r.onClick()
  }
  return { items, navigated }
}

test('no history means no menu, so the overflow button stays hidden', () => {
  expect(
    recentLocationsMenu({
      recentLocations: [],
      onNavigate: () => {},
      onClear: () => {},
    }),
  ).toEqual([])
})

test('a hit whose display string is unsearchable still reopens (regression)', () => {
  // Searching an ID gives a display string of "name (matched attribute)", which
  // is not in the index — replaying it as a query found nothing and reported an
  // unknown reference sequence. The recorded location is what reopens it.
  const hit = new BaseResult({
    label: 'Apple3',
    displayString: 'Apple3 (rna-Apple3)',
    locString: 'ctgA:17400..23000',
  })
  const recorded = recentLocationOf(hit)
  expect(recorded).toEqual({
    label: 'Apple3 (rna-Apple3)',
    loc: 'ctgA:17400..23000',
  })

  const { items, navigated } = replay([recorded])
  expect(rows(items).map(r => r.label)).toEqual(['Apple3 (rna-Apple3)'])
  expect(navigated[0]!.hasLocation()).toBe(true)
  expect(navigated[0]!.getLocation()).toBe('ctgA:17400..23000')
})

test('a freehand query is replayed as a search, not parsed as a locstring', () => {
  // no location to record, and the label is the user's own text, so it is
  // searchable — hasLocation() false routes it back through the search path
  const recorded = recentLocationOf(new BaseResult({ label: 'BRCA' }))
  expect(recorded).toEqual({ label: 'BRCA', loc: undefined })

  const { navigated } = replay([recorded])
  expect(navigated[0]!.hasLocation()).toBe(false)
  expect(navigated[0]!.getLabel()).toBe('BRCA')
})

test('two loci sharing a display string stay two rows', () => {
  // the list dedupes on the location, so the same name at two loci survives as
  // two rows — which the menu keys on `id`, since the labels are identical
  const { items } = replay([
    { label: 'trnA (matched alias)', loc: 'ctgA:100..200' },
    { label: 'trnA (matched alias)', loc: 'ctgB:100..200' },
  ])
  expect((rows(items) as unknown as { id: string }[]).map(r => r.id)).toEqual([
    'loc:ctgA:100..200',
    'loc:ctgB:100..200',
  ])
})

// a freehand query has no location and falls back to its label, which may itself
// read as a locstring — the two namespaces stay apart
test('a freehand query and a recorded location never share an id', () => {
  const { items } = replay([
    { label: 'ctgA:100..200' },
    { label: 'somewhere else', loc: 'ctgA:100..200' },
  ])
  const ids = (rows(items) as unknown as { id: string }[]).map(r => r.id)
  expect(ids).toEqual(['query:ctgA:100..200', 'loc:ctgA:100..200'])
  expect(new Set(ids).size).toBe(2)
})

test('replaying a row records the same row, so the label does not decay', () => {
  const recorded = recentLocationOf(
    new BaseResult({
      label: 'Apple3',
      displayString: 'Apple3 (rna-Apple3)',
      locString: 'ctgA:17400..23000',
    }),
  )
  const { navigated } = replay([recorded])
  expect(recentLocationOf(navigated[0]!)).toEqual(recorded)
})
