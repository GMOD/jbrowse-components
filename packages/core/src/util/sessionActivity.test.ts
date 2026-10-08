import { observable, runInAction } from 'mobx'

import {
  createSessionActivity,
  describeSession,
  tallyTypes,
} from './sessionActivity.ts'

import type { ActivitySession } from './sessionActivity.ts'

function makeSession() {
  return observable<ActivitySession>({
    sessionTracks: [],
    views: [],
    widgets: new Map<string, { type: string }>(),
  })
}

test('describeSession lists the types of views, their shown tracks and widgets', () => {
  const shape = describeSession({
    sessionTracks: [],
    views: [
      {
        type: 'LinearGenomeView',
        tracks: [{ type: 'FeatureTrack' }, { type: 'AlignmentsTrack' }],
      },
      { type: 'DotplotView' },
    ],
    widgets: new Map([['w1', { type: 'BaseFeatureWidget' }]]),
  })

  expect(shape).toEqual({
    viewTypes: ['LinearGenomeView', 'DotplotView'],
    trackTypes: ['FeatureTrack', 'AlignmentsTrack'],
    widgetTypes: ['BaseFeatureWidget'],
  })
})

test('tallyTypes counts each type and sorts by name', () => {
  expect(tallyTypes(['VariantTrack', 'FeatureTrack', 'VariantTrack'])).toBe(
    'FeatureTrack:1,VariantTrack:2',
  )
  expect(tallyTypes([])).toBe('')
})

test('a type opened and then closed stays in the seen lists', () => {
  const session = makeSession()
  const activity = createSessionActivity()
  activity.watch(() => session)

  runInAction(() => {
    session.views.push({
      type: 'LinearGenomeView',
      tracks: [{ type: 'AlignmentsTrack' }, { type: 'VariantTrack' }],
    })
  })
  runInAction(() => {
    session.views[0]!.tracks = [{ type: 'FeatureTrack' }]
  })

  expect(activity.stats()).toEqual({
    'view-types': 'LinearGenomeView:1',
    'open-track-types': 'FeatureTrack:1',
    'seen-view-types': 'LinearGenomeView',
    'seen-track-types': 'AlignmentsTrack,FeatureTrack,VariantTrack',
    'seen-widget-types': '',
    'max-open-views': 1,
    'max-open-tracks': 2,
  })
  activity.stop()
})

test('watching a new session keeps what the previous one showed', () => {
  const first = makeSession()
  const second = makeSession()
  const activity = createSessionActivity()

  activity.watch(() => first)
  runInAction(() => {
    first.views.push({ type: 'CircularView' })
  })
  activity.watch(() => second)
  runInAction(() => {
    second.views.push({ type: 'LinearSyntenyView' })
  })

  expect(activity.stats()['seen-view-types']).toBe(
    'CircularView,LinearSyntenyView',
  )
  expect(activity.stats()['view-types']).toBe('LinearSyntenyView:1')
  activity.stop()
})

test('a session that throws when read leaves the last reading in place', () => {
  const session = makeSession()
  const dead = observable.box(false)
  const activity = createSessionActivity()
  activity.watch(() => {
    if (dead.get()) {
      throw new Error('no longer part of a state tree')
    }
    return session
  })
  runInAction(() => {
    session.views.push({ type: 'LinearGenomeView' })
  })

  runInAction(() => {
    dead.set(true)
  })

  expect(activity.stats()['seen-view-types']).toBe('LinearGenomeView')
  expect(activity.watching).toBe(true)
  activity.stop()
  expect(activity.watching).toBe(false)
})
