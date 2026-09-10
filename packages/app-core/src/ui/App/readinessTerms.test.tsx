import { viewSettled } from '@jbrowse/core/util/whenViewSettled'
import { render } from '@testing-library/react'

import AppReadyMarker from './AppReadyMarker.tsx'

import type { AppSession } from './types.ts'

/**
 * "Has this view finished" is decided from the model in two places, and they
 * have to give the same answer.
 *
 * `AppReadyMarker` decides it for the whole app, because
 * `[data-app-phase="ready"]` is what every outside reader waits on;
 * `whenViewSettled` decides it for one view, because a caller awaiting a single
 * launch cannot wait on the app. ADR-101 declined to merge the three readiness
 * implementations and pinned what they share — but it pinned the SELECTOR
 * STRINGS, and `scripts/readinessContract.test.ts` is a grep over source text.
 * That cannot see a predicate losing a term, which is what happened: the marker
 * had `initialized` and `showLoading` and not `pendingLaunch`, so it called a
 * view ready while the same apply pass was still attaching the tracks a session
 * spec had asked for. `whenViewSettled`'s own docstring had described that
 * window the whole time.
 *
 * So this pins the terms, behaviourally, over shapes where both are defined —
 * every field present, no error. Their null rules differ on purpose (absent
 * means not-loading to the marker, while `whenViewSettled` requires
 * `initialized`), and an adapter between those would read as agreement they do
 * not have; error is terminal to one and reportable to the other. Neither
 * difference is in scope here.
 */
const SHAPES: [string, { initialized: boolean; pendingLaunch?: unknown }][] = [
  ['is still resolving its assembly', { initialized: false }],
  [
    'is positioned but still applying its launch blob',
    { initialized: true, pendingLaunch: { assembly: 'volvox', tracks: ['x'] } },
  ],
  [
    'has neither come up nor consumed its blob',
    { initialized: false, pendingLaunch: { assembly: 'volvox' } },
  ],
  ['is up with nothing pending', { initialized: true }],
]

function phaseOf(view: Record<string, unknown>) {
  const session = {
    views: [{ ...view, ownViews: [], ownTracks: [] }],
  } as unknown as AppSession
  return render(<AppReadyMarker session={session} />).getByTestId(
    'app-ready-marker',
  ).dataset.appPhase
}

describe('the marker and whenViewSettled decide a view the same way', () => {
  it.each(SHAPES)('a view that %s', (_name, view) => {
    const settled = viewSettled({ ...view, error: undefined })
    expect(phaseOf(view)).toBe(settled ? 'ready' : 'loading')
  })
})
