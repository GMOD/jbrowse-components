import { render } from '@testing-library/react'

import AppReadyMarker from './AppReadyMarker.tsx'

import type { AppSession } from './types.ts'

const session = (views: unknown[]) => ({ views }) as unknown as AppSession
const phaseOf = (views: unknown[]) =>
  render(<AppReadyMarker session={session(views)} />).getByTestId(
    'app-ready-marker',
  ).dataset.appPhase

// The one selector anything driving JBrowse from outside waits for. It has to
// be POSITIVE — rendered when the app is done — because every other readiness
// signal is an absence, and an absence is equally true of an app that has not
// started.
test('an empty session is ready', () => {
  expect(phaseOf([])).toBe('ready')
})

test('a view resolving its assembly is loading', () => {
  expect(phaseOf([{ showLoading: true }])).toBe('loading')
})

test('an uninitialized view is loading', () => {
  expect(phaseOf([{ initialized: false }])).toBe('loading')
})

test('a display mid-fetch is loading', () => {
  expect(
    phaseOf([{ tracks: [{ displays: [{ displayPhase: 'loading' }] }] }]),
  ).toBe('loading')
})

test('every display finished is ready', () => {
  expect(
    phaseOf([
      {
        tracks: [
          { displays: [{ displayPhase: 'ready' }] },
          { displays: [{ displayPhase: 'ready' }] },
        ],
      },
    ]),
  ).toBe('ready')
})

// A terminal phase is finished, not pending — a display showing "too large to
// render" is never going to draw, and waiting for it would hang.
test('a display in a terminal phase is ready', () => {
  expect(
    phaseOf([{ tracks: [{ displays: [{ displayPhase: 'tooLarge' }] }] }]),
  ).toBe('ready')
})

// One loading display among finished ones still holds the whole app loading:
// the marker is the conjunction, which is what makes it one selector instead of
// a census.
test('one loading display among many holds the app loading', () => {
  expect(
    phaseOf([
      {
        tracks: [
          { displays: [{ displayPhase: 'ready' }] },
          { displays: [{ displayPhase: 'loading' }] },
        ],
      },
    ]),
  ).toBe('loading')
})

// A container view holds sub-views with track lists of their own — the synteny
// view's genome rows — so a walk that reads the top level only reports a loading
// app as ready.
test('a sub-view display is reached', () => {
  expect(
    phaseOf([
      { views: [{ tracks: [{ displays: [{ displayPhase: 'loading' }] }] }] },
    ]),
  ).toBe('loading')
})

// And the other half of that view, which the sub-view walk does NOT reach: its
// synteny tracks hang off `levels`, one list per band, published as
// `trackContainers`. `view.tracks` is empty there, so a stack of ribbons still
// fetching used to read as idle.
test('a display in a track container the view owns is reached', () => {
  expect(
    phaseOf([
      {
        tracks: [],
        trackContainers: [
          { tracks: [{ displays: [{ displayPhase: 'loading' }] }] },
        ],
      },
    ]),
  ).toBe('loading')
})

test('a finished track container is ready', () => {
  expect(
    phaseOf([
      {
        trackContainers: [
          { tracks: [{ displays: [{ displayPhase: 'ready' }] }] },
        ],
      },
    ]),
  ).toBe('ready')
})
