import { render } from '@testing-library/react'

import AppReadyMarker from './AppReadyMarker.tsx'

import type { AppSession } from './types.ts'

// The marker reads the census CONTRACT — each view's `allViews`/`ownTracks`,
// which BaseViewModel derives — so what these tests pin is the reduction: the
// phase over the flags and display phases, and the census attributes. The walk
// behind the contract has its own tests against real composed models
// (core/pluggableElementTypes/models/BaseViewModel.test.ts), and
// jbrowse-web's AppReadyMarkerComparative.test.tsx renders the two together.
interface FakeView {
  showLoading?: boolean
  initialized?: boolean
  assemblyNames?: string[]
  tracks?: { trackId?: string; displays?: { displayPhase?: string }[] }[]
  views?: FakeView[]
}

function view(v: FakeView): Record<string, unknown> {
  const children = (v.views ?? []).map(view)
  const self: Record<string, unknown> = {
    ...v,
    ownTracks: (v.tracks ?? []).map(t => ({
      configuration: { trackId: t.trackId },
      displays: t.displays ?? [],
    })),
  }
  self.allViews = [self, ...children.flatMap(c => c.allViews as unknown[])]
  return self
}

const session = (views: FakeView[]) =>
  ({ views: views.map(view) }) as unknown as AppSession

const markerOf = (views: FakeView[]) =>
  render(<AppReadyMarker session={session(views)} />).getByTestId(
    'app-ready-marker',
  )
const phaseOf = (views: FakeView[]) => markerOf(views).dataset.appPhase

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

// A container view's rows arrive through its `allViews`, so a loading display
// on a nested view holds the app — the marker never walks the nesting itself.
test('a display on a nested view is reached', () => {
  expect(
    phaseOf([
      { views: [{ tracks: [{ displays: [{ displayPhase: 'loading' }] }] }] },
    ]),
  ).toBe('loading')
})

// The census: what is open, published beside whether it is done, so an outside
// reader asks one element "is the track I requested actually open" instead of
// walking the session model with its own copy of the view nesting.
test('the marker publishes the open-track and assembly census', () => {
  const marker = markerOf([
    {
      assemblyNames: ['hg38'],
      tracks: [{ trackId: 'genes' }],
      views: [{ assemblyNames: ['hg38'], tracks: [{ trackId: 'reads' }] }],
    },
  ])
  expect(marker.dataset.appViews).toBe('1')
  expect(JSON.parse(marker.dataset.appAssemblies!)).toEqual(['hg38'])
  expect(JSON.parse(marker.dataset.appTracks!)).toEqual(['genes', 'reads'])
})

test('an empty session publishes an empty census, not missing attributes', () => {
  const marker = markerOf([])
  expect(marker.dataset.appViews).toBe('0')
  expect(JSON.parse(marker.dataset.appAssemblies!)).toEqual([])
  expect(JSON.parse(marker.dataset.appTracks!)).toEqual([])
})
