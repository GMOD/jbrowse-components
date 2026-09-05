import { types } from '@jbrowse/mobx-state-tree'

import BaseViewModel from './BaseViewModel.ts'

// The census contract. ownTracks/allViews/allTracks are how everything outside
// a view — AppReadyMarker, jbApi, and via the marker's published attributes
// @jbrowse/capture — enumerates what is open without knowing which property a
// container view keeps its children on. Exercised against real composed models,
// because the walk itself is what these pin: a stand-in re-implementing it
// would pass whatever the base does.

const Track = types.model('Track', {
  trackId: types.string,
  configuration: types.optional(types.frozen(), {}),
  displays: types.optional(types.array(types.frozen()), []),
})

const PlainView = types.compose(
  BaseViewModel,
  types.model({ type: 'Plain', tracks: types.array(Track) }),
)

// the synteny shape: tracks per band on `levels`, published as
// `trackContainers`, child views on `views`, its own `tracks` absent
const ContainerView = types
  .compose(
    BaseViewModel,
    types.model({
      type: 'Container',
      levels: types.array(types.model({ tracks: types.array(Track) })),
      views: types.array(PlainView),
    }),
  )
  .views(self => ({
    get trackContainers() {
      return [...self.levels]
    },
  }))

const ids = (tracks: readonly unknown[]) =>
  tracks.map(t => (t as { trackId?: string }).trackId)

test('a plain view owns its own tracks and nothing else', () => {
  const view = PlainView.create({ tracks: [{ trackId: 'genes' }] })
  expect(ids(view.ownTracks)).toEqual(['genes'])
  expect(view.allViews).toEqual([view])
  expect(ids(view.allTracks)).toEqual(['genes'])
})

test('a container view answers for its bands and its rows', () => {
  const view = ContainerView.create({
    levels: [{ tracks: [{ trackId: 'mat_vs_pat' }] }],
    views: [
      { tracks: [{ trackId: 'top_genes' }] },
      { tracks: [{ trackId: 'bottom_genes' }] },
    ],
  })
  expect(ids(view.ownTracks)).toEqual(['mat_vs_pat'])
  expect(view.allViews).toHaveLength(3)
  expect(ids(view.allTracks)).toEqual([
    'mat_vs_pat',
    'top_genes',
    'bottom_genes',
  ])
})

// The dotplot keeps its two 1D axis models under a prop also named `views`. An
// axis is not a view — descending into one put undefined in the census — so
// only a child carrying the contract itself answers.
test('a non-view living under `views` is not descended into', () => {
  const WithAxes = types.compose(
    BaseViewModel,
    types.model({
      type: 'Dotplotish',
      tracks: types.array(Track),
      views: types.array(types.model({ bpPerPx: types.maybe(types.number) })),
    }),
  )
  const view = WithAxes.create({
    tracks: [{ trackId: 'paf' }],
    views: [{}, {}],
  })
  expect(view.allViews).toEqual([view])
  expect(ids(view.allTracks)).toEqual(['paf'])
})

// react-msaview's view keeps its MSA annotation rows under `tracks`. A row has
// no displays and no configuration, and reading either off it as a track
// crashed the readiness marker for every session holding an MSA view.
test('a non-track living under `tracks` is not a track', () => {
  const Msaish = types.compose(
    BaseViewModel,
    types.model({
      type: 'Msaish',
      tracks: types.array(
        types.model({ id: types.string, name: types.string }),
      ),
    }),
  )
  const view = Msaish.create({ tracks: [{ id: 'ann', name: 'Annotations' }] })
  expect(view.ownTracks).toEqual([])
  expect(view.allTracks).toEqual([])
})

test('a view with no track-bearing properties reports empty, not undefined', () => {
  const Bare = types.compose(BaseViewModel, types.model({ type: 'Bare' }))
  const view = Bare.create({})
  expect(view.ownTracks).toEqual([])
  expect(view.allViews).toEqual([view])
  expect(view.allTracks).toEqual([])
})
