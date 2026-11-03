import { types } from '@jbrowse/mobx-state-tree'

import { getNotificationSink } from '../../util/sessionServices.ts'
import BaseViewModel from './BaseViewModel.ts'

// The census contract: what a view declares it holds. Everything outside a view
// — AppReadyMarker, jbApi, and via the marker's published attributes
// @jbrowse/capture — enumerates through `openViews`/`openTracks` over these,
// which is where the recursion is pinned. What these pin is the other half: the
// base declares nothing on a view's behalf.

const Track = types.model('Track', { trackId: types.string })

const ids = (tracks: readonly unknown[]) =>
  tracks.map(t => (t as { trackId?: string }).trackId)

test('a view declares what it holds', () => {
  const View = types
    .compose(
      BaseViewModel,
      types.model({ type: 'Plain', tracks: types.array(Track) }),
    )
    .views(self => ({
      get ownTracks() {
        return [...self.tracks]
      },
    }))
  const view = View.create({ tracks: [{ trackId: 'genes' }] })
  expect(ids(view.ownTracks)).toEqual(['genes'])
})

test('a view that declares nothing holds nothing, rather than undefined', () => {
  const Bare = types.compose(BaseViewModel, types.model({ type: 'Bare' }))
  const view = Bare.create({})
  expect(view.ownTracks).toEqual([])
  expect(view.ownViews).toEqual([])
})

// react-msaview's view keeps its MSA annotation rows under `tracks`: no
// configuration, no displays, not tracks. A base that read the property for it
// handed those rows to the readiness marker and error-paged every session
// holding an MSA view. Nothing about the shape said not to — only the view
// knows, so only the view says.
test('a `tracks` property is not a declaration', () => {
  const Msaish = types.compose(
    BaseViewModel,
    types.model({
      type: 'Msaish',
      tracks: types.array(types.model({ id: types.string })),
    }),
  )
  const view = Msaish.create({ tracks: [{ id: 'annotations' }] })
  expect(view.ownTracks).toEqual([])
})

// The dotplot's `views` prop holds its two 1D axis models, which carry a width
// and a bpPerPx and are not views the user opened. The same rule, one level up.
test('a `views` property is not a declaration either', () => {
  const Dotplotish = types.compose(
    BaseViewModel,
    types.model({
      type: 'Dotplotish',
      views: types.array(types.model({ bpPerPx: types.maybe(types.number) })),
    }),
  )
  const view = Dotplotish.create({ views: [{}, {}] })
  expect(view.ownViews).toEqual([])
})

test('an error reported inside a view is kept on the outermost view, and still reaches the session', () => {
  const Display = types.model('Display', {}).actions(self => ({
    fail() {
      getNotificationSink(self).notifyError('boom', 'cause')
    },
    warn() {
      getNotificationSink(self).notify('careful', 'warning')
    },
  }))
  const Row = types.compose(
    BaseViewModel,
    types.model({ type: 'Row', display: Display }),
  )
  const Stack = types.compose(
    BaseViewModel,
    types.model({ type: 'Stack', rows: types.array(Row) }),
  )
  const notified: unknown[][] = []
  const Session = types
    .model('Session', {
      rpcManager: types.frozen({}),
      configuration: types.frozen({}),
      views: types.array(Stack),
    })
    .actions(() => ({
      notify(...args: unknown[]) {
        notified.push(args)
      },
      notifyError(...args: unknown[]) {
        notified.push(args)
      },
    }))
  const session = Session.create({ views: [{ rows: [{ display: {} }] }] })
  const stack = session.views[0]!
  stack.rows[0]!.display.fail()
  stack.rows[0]!.display.warn()
  expect(stack.problems).toEqual([{ message: 'boom', error: 'cause' }])
  expect(stack.rows[0]!.problems).toEqual([])
  expect(notified).toEqual([
    ['boom', 'cause'],
    ['careful', 'warning'],
  ])
})
