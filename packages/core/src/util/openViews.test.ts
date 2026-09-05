import { types } from '@jbrowse/mobx-state-tree'

import BaseViewModel from '../pluggableElementTypes/models/BaseViewModel.ts'
import { openTracks, openViews } from './openViews.ts'

import type { AbstractSessionModel } from './types/index.ts'

// The recursion the four consumers used to each carry a copy of, against real
// composed models: a stand-in re-implementing the walk would pass whatever this
// module does.

const Track = types.model('Track', { trackId: types.string })

const PlainView = types
  .compose(
    BaseViewModel,
    types.model({ type: 'Plain', tracks: types.array(Track) }),
  )
  .views(self => ({
    get ownTracks() {
      return [...self.tracks]
    },
  }))

// the synteny shape: tracks per band on `levels`, rows on `views`, no `tracks`
// of its own
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
    get ownTracks() {
      return self.levels.flatMap(l => [...l.tracks])
    },
    get ownViews() {
      return [...self.views]
    },
  }))

// views as created instances rather than one MST session model: a union of two
// composed views has no discriminator to dispatch a snapshot on
const sessionOf = (...views: unknown[]) =>
  ({ views }) as unknown as AbstractSessionModel

const ids = (tracks: readonly unknown[]) =>
  tracks.map(t => (t as { trackId?: string }).trackId)

test('a session of plain views enumerates each once', () => {
  const session = sessionOf(
    PlainView.create({ tracks: [{ trackId: 'genes' }] }),
    PlainView.create({ tracks: [{ trackId: 'reads' }] }),
  )
  expect(openViews(session)).toHaveLength(2)
  expect(ids(openTracks(session))).toEqual(['genes', 'reads'])
})

test('a container contributes itself, its bands and its rows', () => {
  const session = sessionOf(
    ContainerView.create({
      levels: [{ tracks: [{ trackId: 'mat_vs_pat' }] }],
      views: [
        { tracks: [{ trackId: 'top_genes' }] },
        { tracks: [{ trackId: 'bottom_genes' }] },
      ],
    }),
  )
  expect(openViews(session)).toHaveLength(3)
  expect(ids(openTracks(session))).toEqual([
    'mat_vs_pat',
    'top_genes',
    'bottom_genes',
  ])
})

test('nesting is followed to any depth, not flattened one level', () => {
  const Outer = types
    .compose(
      BaseViewModel,
      types.model({ type: 'Outer', views: types.array(ContainerView) }),
    )
    .views(self => ({
      get ownViews() {
        return [...self.views]
      },
    }))
  const session = sessionOf(
    Outer.create({
      views: [{ levels: [], views: [{ tracks: [{ trackId: 'deep' }] }] }],
    }),
  )

  expect(openViews(session)).toHaveLength(3)
  expect(ids(openTracks(session))).toEqual(['deep'])
})

// A view plugin built against a core older than these getters is missing them,
// not lying about them. Under-reporting costs a census entry; throwing would
// cost the session, which is the failure this whole contract exists to avoid.
test('a view from before the contract is skipped, not thrown on', () => {
  const session = sessionOf({ id: 'legacy', type: 'Legacy' })
  expect(openViews(session)).toHaveLength(1)
  expect(openTracks(session)).toEqual([])
})
