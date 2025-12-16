import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import HierarchicalTrackSelector from './HierarchicalTrackSelector'
import conf from '../../../../../test_data/test_order/config.json'

import type { HierarchicalTrackSelectorModel } from '../model'

// test data

// mock
jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

function timeout(ms: number) {
  return new Promise(res => setTimeout(res, ms))
}

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

test('no tracks', () => {
  const session = createTestSession()
  const firstView = session.addView('LinearGenomeView')
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel

  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )
  expect(model.allTracks[0]!.tracks.length).toBe(0)
})

test('sm uncategorized tracks', async () => {
  // session tracks
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model = firstView.activateTrackSelector()

  const { findAllByTestId: f } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )
  expect((await f(/htsTrackLabel/)).map(e => e.textContent)).toMatchSnapshot()
})

test('sm categorized tracks', async () => {
  const session = addTestData(createTestSession())

  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  firstView.showTrack(session.sessionTracks[0].trackId)
  firstView.showTrack(session.sessionTracks[1].trackId)
  firstView.tracks[0].configuration.category.set(['Foo Category'])
  firstView.tracks[1].configuration.category.set([
    'Foo Category',
    'Bar Category',
  ])
  const model = firstView.activateTrackSelector()

  const { findAllByTestId: f } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )

  expect((await f(/htsTrackLabel/)).map(e => e.textContent)).toMatchSnapshot()
})

test('localstorage preference - collapse categorized tracks', async () => {
  localStorage.setItem(
    'collapsedCategories-/-volMyt1-LinearGenomeView',
    '[["Tracks-Foo Category",true]]',
  )
  const session = addTestData(createTestSession())

  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  firstView.showTrack(session.sessionTracks[0].trackId)
  firstView.showTrack(session.sessionTracks[1].trackId)
  firstView.tracks[0].configuration.category.set(['Foo Category'])
  firstView.tracks[1].configuration.category.set([
    'Foo Category',
    'Bar Category',
  ])
  const model = firstView.activateTrackSelector()

  const { findAllByTestId: f } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )
  await timeout(1000)
  expect((await f(/htsTrackLabel/)).map(e => e.textContent)).toMatchSnapshot()
})

test('configuration preference - collapse categorized tracks', async () => {
  const session = addTestData(
    createTestSession({
      jbrowseConfig: {
        configuration: {
          hierarchical: {
            defaultCollapsed: {
              categoryNames: ['Foo Category'],
            },
          },
        },
      },
    }),
  )

  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  firstView.showTrack(session.sessionTracks[0].trackId)
  firstView.showTrack(session.sessionTracks[1].trackId)
  firstView.tracks[0].configuration.category.set(['Foo Category'])
  firstView.tracks[1].configuration.category.set([
    'Foo Category',
    'Bar Category',
  ])
  const model = firstView.activateTrackSelector()

  const { findAllByTestId: f } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )

  expect((await f(/htsTrackLabel/)).map(e => e.textContent)).toMatchSnapshot()
})

test('unsorted categories', async () => {
  const session = createTestSession({
    jbrowseConfig: conf,
  })
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })

  const model = firstView.activateTrackSelector()

  const { findAllByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )

  expect(
    (await findAllByTestId(/htsTrackLabel/)).map(e => e.textContent),
  ).toMatchSnapshot()
})

test('configuration preference - sorting categories', async () => {
  const session = createTestSession({
    jbrowseConfig: {
      tracks: shuffle(conf.tracks),
      configuration: {
        hierarchical: {
          sort: {
            categories: true,
          },
        },
      },
    },
  })

  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })

  const model = firstView.activateTrackSelector()

  const { findAllByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )

  expect(
    (await findAllByTestId(/htsCategory/)).map(e => e.textContent),
  ).toMatchSnapshot()
})

test('configuration preference - sorting track names', async () => {
  const session = createTestSession({
    jbrowseConfig: {
      tracks: shuffle(conf.tracks),
      configuration: {
        hierarchical: {
          sort: {
            trackNames: true,
          },
        },
      },
    },
  })

  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })

  const model = firstView.activateTrackSelector()

  const { findAllByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )

  expect(
    (await findAllByTestId(/htsCategory/)).map(e => e.textContent),
  ).toMatchSnapshot()
})

test('localstorage preference - sorting categories', async () => {
  localStorage.setItem('sortCategories', 'true')
  const session = createTestSession({
    jbrowseConfig: {
      tracks: shuffle(conf.tracks),
    },
  })

  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })

  const model = firstView.activateTrackSelector()

  const { findAllByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )

  expect(
    (await findAllByTestId(/htsCategory/)).map(e => e.textContent),
  ).toMatchSnapshot()
})

test('localstorage preference - sorting track names', async () => {
  // use localstorage preference
  localStorage.setItem('sortTrackNames', 'true')
  const session = createTestSession()

  for (const track of shuffle(conf.tracks)) {
    session.addTrackConf(track)
  }

  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })

  const model = firstView.activateTrackSelector()

  const { findAllByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )

  const list = await findAllByTestId('htsTrackLabel', {
    exact: false,
  })
  const trackNameList = []
  for (const entry of list) {
    trackNameList.push(entry.textContent)
  }
  expect(trackNameList).toMatchSnapshot()
})

test('ctrl+click toggles track selection', async () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel

  const { findAllByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )

  // find all track labels and get the first one
  const trackLabels = await findAllByTestId(/htsTrackLabel/)
  const trackLabel = trackLabels[0]!
  const formControlLabel = trackLabel.closest('label')!

  // initially no selection
  expect(model.selection.length).toBe(0)

  // ctrl+click adds to selection
  fireEvent.click(formControlLabel, { ctrlKey: true })
  expect(model.selection.length).toBe(1)

  // ctrl+click again removes from selection
  fireEvent.click(formControlLabel, { ctrlKey: true })
  expect(model.selection.length).toBe(0)
})

test('meta+click (Cmd on Mac) toggles track selection', async () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel

  const { findAllByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )

  const trackLabels = await findAllByTestId(/htsTrackLabel/)
  const trackLabel = trackLabels[0]!
  const formControlLabel = trackLabel.closest('label')!

  expect(model.selection.length).toBe(0)

  // meta+click (Cmd on Mac) adds to selection
  fireEvent.click(formControlLabel, { metaKey: true })
  expect(model.selection.length).toBe(1)

  // meta+click again removes from selection
  fireEvent.click(formControlLabel, { metaKey: true })
  expect(model.selection.length).toBe(0)
})

test('ctrl+click on multiple tracks adds all to selection', async () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel

  const { findAllByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )

  const trackLabels = await findAllByTestId(/htsTrackLabel/)
  expect(trackLabels.length).toBeGreaterThanOrEqual(2)

  const formControlLabel1 = trackLabels[0]!.closest('label')!
  const formControlLabel2 = trackLabels[1]!.closest('label')!

  expect(model.selection.length).toBe(0)

  // ctrl+click first track
  fireEvent.click(formControlLabel1, { ctrlKey: true })
  expect(model.selection.length).toBe(1)

  // ctrl+click second track
  fireEvent.click(formControlLabel2, { ctrlKey: true })
  expect(model.selection.length).toBe(2)

  // ctrl+click first track again removes it
  fireEvent.click(formControlLabel1, { ctrlKey: true })
  expect(model.selection.length).toBe(1)
})

test('regular click does not affect selection', async () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel

  const { findAllByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )

  const trackLabels = await findAllByTestId(/htsTrackLabel/)
  const trackLabel = trackLabels[0]!
  const formControlLabel = trackLabel.closest('label')!

  // first add to selection with ctrl+click
  fireEvent.click(formControlLabel, { ctrlKey: true })
  expect(model.selection.length).toBe(1)

  // regular click should not change selection
  fireEvent.click(formControlLabel)
  expect(model.selection.length).toBe(1)
})

test('checkbox click toggles track visibility', async () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel

  const { findAllByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )

  const checkboxes = await findAllByTestId(/htsTrackEntry/)
  const checkbox = checkboxes[0]! as HTMLInputElement

  // initially track is not shown
  expect(checkbox.checked).toBe(false)
  expect(firstView.tracks.length).toBe(0)

  // click checkbox to show track
  fireEvent.click(checkbox)
  expect(firstView.tracks.length).toBe(1)

  // click checkbox again to hide track
  fireEvent.click(checkbox)
  expect(firstView.tracks.length).toBe(0)
})

test('filter text filters tracks', async () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel

  const { findAllByTestId, queryAllByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} toolbarHeight={20} />
    </ThemeProvider>,
  )

  // initially all tracks visible (includes reference sequence track)
  const initialLabels = await findAllByTestId(/htsTrackLabel/)
  const initialCount = initialLabels.length

  // filter to only show fooC
  model.setFilterText('fooC')

  // wait for re-render and check filtered results
  await timeout(100)
  const filteredLabels = queryAllByTestId(/htsTrackLabel/)
  expect(filteredLabels.length).toBe(1)
  expect(filteredLabels[0]!.textContent).toBe('fooC')

  // clear filter shows all tracks again
  model.clearFilterText()
  await timeout(100)
  const clearedLabels = queryAllByTestId(/htsTrackLabel/)
  expect(clearedLabels.length).toBe(initialCount)
})

test('model tracks favorites', () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel

  // initially no favorites
  expect(model.favorites.length).toBe(0)
  expect(model.isFavorite('fooC')).toBe(false)

  // add to favorites
  model.addToFavorites('fooC')
  expect(model.favorites.length).toBe(1)
  expect(model.isFavorite('fooC')).toBe(true)

  // add another
  model.addToFavorites('barC')
  expect(model.favorites.length).toBe(2)

  // remove from favorites
  model.removeFromFavorites('fooC')
  expect(model.favorites.length).toBe(1)
  expect(model.isFavorite('fooC')).toBe(false)
  expect(model.isFavorite('barC')).toBe(true)

  // clear all favorites
  model.clearFavorites()
  expect(model.favorites.length).toBe(0)
})

test('model tracks recently used', () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel

  // initially no recently used
  expect(model.recentlyUsed.length).toBe(0)
  expect(model.isRecentlyUsed('fooC')).toBe(false)

  // add to recently used
  model.addToRecentlyUsed('fooC')
  expect(model.recentlyUsed.length).toBe(1)
  expect(model.isRecentlyUsed('fooC')).toBe(true)

  // adding same track again doesn't duplicate
  model.addToRecentlyUsed('fooC')
  expect(model.recentlyUsed.length).toBe(1)

  // add another
  model.addToRecentlyUsed('barC')
  expect(model.recentlyUsed.length).toBe(2)

  // clear recently used
  model.clearRecentlyUsed()
  expect(model.recentlyUsed.length).toBe(0)
})

test('model selection methods', () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel

  const tracks = model.allTrackConfigurations
  expect(tracks.length).toBeGreaterThanOrEqual(2)

  // initially no selection
  expect(model.selection.length).toBe(0)
  expect(model.isSelected(tracks[0]!)).toBe(false)

  // setSelection replaces entire selection
  model.setSelection([tracks[0]!])
  expect(model.selection.length).toBe(1)
  expect(model.isSelected(tracks[0]!)).toBe(true)

  // addToSelection appends
  model.addToSelection([tracks[1]!])
  expect(model.selection.length).toBe(2)
  expect(model.isSelected(tracks[0]!)).toBe(true)
  expect(model.isSelected(tracks[1]!)).toBe(true)

  // addToSelection deduplicates
  model.addToSelection([tracks[0]!])
  expect(model.selection.length).toBe(2)

  // removeFromSelection removes specific tracks
  model.removeFromSelection([tracks[0]!])
  expect(model.selection.length).toBe(1)
  expect(model.isSelected(tracks[0]!)).toBe(false)
  expect(model.isSelected(tracks[1]!)).toBe(true)

  // clearSelection removes all
  model.clearSelection()
  expect(model.selection.length).toBe(0)
})

test('category collapse and expand', async () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel

  // collapse a category
  model.setCategoryCollapsed('Tracks', true)
  expect(model.collapsed.get('Tracks')).toBe(true)

  // toggle category
  model.toggleCategory('Tracks')
  expect(model.collapsed.get('Tracks')).toBe(false)

  // expand all categories
  model.setCategoryCollapsed('Tracks', true)
  model.expandAllCategories()
  expect(model.collapsed.size).toBe(0)
})

// -------------------------- Faceted model tests -

test('faceted model filter text', () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel
  const { faceted } = model

  // initially empty filter
  expect(faceted.filterText).toBe('')

  // set filter text
  faceted.setFilterText('foo')
  expect(faceted.filterText).toBe('foo')

  // rows should be filtered
  const filteredRows = faceted.rows.filter(r => r.name.includes('foo'))
  expect(faceted.rows.length).toBe(filteredRows.length)
})

test('faceted model column filters', () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel
  const { faceted } = model

  // initially no filters
  expect(faceted.filters.size).toBe(0)

  // all rows visible initially
  const initialRowCount = faceted.filteredRows.length

  // set a filter
  faceted.setFilter('adapter', ['FromConfigAdapter'])
  expect(faceted.filters.get('adapter')).toEqual(['FromConfigAdapter'])

  // filteredRows should only include matching rows
  expect(faceted.filteredRows.every(r => r.adapter === 'FromConfigAdapter')).toBe(true)

  // clear filter by setting empty array
  faceted.setFilter('adapter', [])
  expect(faceted.filteredRows.length).toBe(initialRowCount)
})

test('faceted model toggle options', () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel
  const { faceted } = model

  // test showSparse toggle
  const initialShowSparse = faceted.showSparse
  faceted.setShowSparse(!initialShowSparse)
  expect(faceted.showSparse).toBe(!initialShowSparse)

  // test showFilters toggle
  const initialShowFilters = faceted.showFilters
  faceted.setShowFilters(!initialShowFilters)
  expect(faceted.showFilters).toBe(!initialShowFilters)

  // test showOptions toggle
  const initialShowOptions = faceted.showOptions
  faceted.setShowOptions(!initialShowOptions)
  expect(faceted.showOptions).toBe(!initialShowOptions)

  // test useShoppingCart toggle
  expect(faceted.useShoppingCart).toBe(false)
  faceted.setUseShoppingCart(true)
  expect(faceted.useShoppingCart).toBe(true)
})

test('faceted model panel width', () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel
  const { faceted } = model

  // set panel width
  faceted.setPanelWidth(500)
  expect(faceted.panelWidth).toBe(500)

  faceted.setPanelWidth(300)
  expect(faceted.panelWidth).toBe(300)
})

test('faceted model rows contain expected data', () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel
  const { faceted } = model

  // rows should have expected structure
  expect(faceted.rows.length).toBeGreaterThan(0)

  const row = faceted.rows.find(r => r.id === 'fooC')
  expect(row).toBeDefined()
  expect(row!.name).toBe('fooC')
  expect(row!.adapter).toBe('FromConfigAdapter')
  expect(row!.conf).toBeDefined()
})

test('faceted model fields includes expected columns', () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel
  const { faceted } = model

  // fields should always include 'name'
  expect(faceted.fields).toContain('name')

  // with showSparse=false, sparse columns are hidden
  // enable showSparse to see all columns
  faceted.setShowSparse(true)
  expect(faceted.fields).toContain('adapter')
})

test('faceted model multiple column filters', () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel
  const { faceted } = model

  const initialCount = faceted.filteredRows.length

  // apply filter to adapter column
  faceted.setFilter('adapter', ['FromConfigAdapter'])
  const afterFirstFilter = faceted.filteredRows.length

  // apply second filter - results should be intersection
  faceted.setFilter('name', ['fooC'])
  const afterSecondFilter = faceted.filteredRows.length

  expect(afterSecondFilter).toBeLessThanOrEqual(afterFirstFilter)
  expect(afterFirstFilter).toBeLessThanOrEqual(initialCount)

  // verify the remaining row matches both filters
  if (afterSecondFilter > 0) {
    expect(faceted.filteredRows[0]!.adapter).toBe('FromConfigAdapter')
    expect(faceted.filteredRows[0]!.name).toBe('fooC')
  }
})

test('faceted model filter with multiple values', () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel
  const { faceted } = model

  // filter with multiple allowed values (OR logic within column)
  faceted.setFilter('name', ['fooC', 'barC'])

  // should include rows matching either value
  const names = faceted.filteredRows.map(r => r.name)
  expect(names).toContain('fooC')
  expect(names).toContain('barC')
})

test('faceted model column visibility', () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel
  const { faceted } = model

  // setVisible sets column visibility
  faceted.setVisible({ name: true, adapter: false })
  expect(faceted.visible.name).toBe(true)
  expect(faceted.visible.adapter).toBe(false)

  // update visibility
  faceted.setVisible({ name: true, adapter: true, category: true })
  expect(faceted.visible.adapter).toBe(true)
  expect(faceted.visible.category).toBe(true)
})

test('faceted and hierarchical filter text are independent', () => {
  const session = addTestData(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel
  const { faceted } = model

  // set hierarchical filter
  model.setFilterText('foo')
  expect(model.filterText).toBe('foo')
  expect(faceted.filterText).toBe('')

  // set faceted filter
  faceted.setFilterText('bar')
  expect(model.filterText).toBe('foo')
  expect(faceted.filterText).toBe('bar')

  // clear hierarchical filter
  model.clearFilterText()
  expect(model.filterText).toBe('')
  expect(faceted.filterText).toBe('bar')
})

test('faceted filter drilling down behavior', () => {
  const session = addTestDataWithCategories(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel
  const { faceted } = model

  // get initial state
  const allRows = faceted.filteredRows
  const initialCount = allRows.length
  expect(initialCount).toBeGreaterThanOrEqual(3)

  // simulate selecting a category facet value
  faceted.setFilter('category', ['Genes'])
  const afterCategoryFilter = faceted.filteredRows

  // should have fewer rows after filtering
  expect(afterCategoryFilter.length).toBeLessThan(initialCount)

  // all remaining rows should have the selected category
  expect(afterCategoryFilter.every(r => r.category === 'Genes')).toBe(true)

  // add another filter - simulate drilling down
  faceted.setFilter('adapter', ['FromConfigAdapter'])
  const afterDrillDown = faceted.filteredRows

  // should have equal or fewer rows
  expect(afterDrillDown.length).toBeLessThanOrEqual(afterCategoryFilter.length)

  // all rows should match both filters
  for (const row of afterDrillDown) {
    expect(row.category).toBe('Genes')
    expect(row.adapter).toBe('FromConfigAdapter')
  }

  // clearing one filter should show more rows again
  faceted.setFilter('category', [])
  expect(faceted.filteredRows.length).toBeGreaterThanOrEqual(afterDrillDown.length)
})

test('faceted filter tracks unique values per column', () => {
  const session = addTestDataWithCategories(createTestSession())
  const firstView = session.addView('LinearGenomeView', {
    displayedRegions: [
      {
        assemblyName: 'volMyt1',
        refName: 'ctgA',
        start: 0,
        end: 1000,
      },
    ],
  })
  const model =
    firstView.activateTrackSelector() as HierarchicalTrackSelectorModel
  const { faceted } = model

  // get unique categories from rows
  const categories = [...new Set(faceted.rows.map(r => r.category).filter(Boolean))]

  // should have multiple categories from test data
  expect(categories.length).toBeGreaterThanOrEqual(2)
  expect(categories).toContain('Genes')
  expect(categories).toContain('Alignments')
})

// -------------------------- test utils -

function addTestData(session: ReturnType<typeof createTestSession>) {
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  })

  session.addTrackConf({
    trackId: 'fooC',
    name: 'fooC',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  session.addTrackConf({
    trackId: 'barC',
    name: 'barC',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  return session
}

function addTestDataWithCategories(session: ReturnType<typeof createTestSession>) {
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  })

  session.addTrackConf({
    trackId: 'geneTrack1',
    name: 'Gene Track 1',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    category: ['Genes'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  session.addTrackConf({
    trackId: 'geneTrack2',
    name: 'Gene Track 2',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    category: ['Genes'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  session.addTrackConf({
    trackId: 'alignmentTrack1',
    name: 'Alignment Track 1',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    category: ['Alignments'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  session.addTrackConf({
    trackId: 'variantTrack1',
    name: 'Variant Track 1',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    category: ['Variants'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  return session
}

function shuffle<T>(copy: T[]) {
  const array = [...copy]
  let currentIndex = array.length

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    const randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--

    // And swap it with the current element.
    ;[array[currentIndex], array[randomIndex]] = [
      array[randomIndex]!,
      array[currentIndex]!,
    ]
  }
  return array
}
