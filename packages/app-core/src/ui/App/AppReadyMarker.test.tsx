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

// A container view (synteny, dotplot) keeps its tracks on sub-views, so a walk
// that reads the top level only reports a loading app as ready.
test('a sub-view display is reached', () => {
  expect(
    phaseOf([
      { views: [{ tracks: [{ displays: [{ displayPhase: 'loading' }] }] }] },
    ]),
  ).toBe('loading')
})
