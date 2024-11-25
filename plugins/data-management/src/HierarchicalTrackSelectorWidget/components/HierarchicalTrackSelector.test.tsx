import React from 'react'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

// locals
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
