import { useState } from 'react'

import { observer } from 'mobx-react'

import { Loader } from '../components/Loader.tsx'

jest.mock('../makeWorkerInstance', () => () => {})

// disposeLoader used to be mocked to a no-op here, because destroying the
// rootModel during React unmount raced with pending async work and surfaced
// noisy errors. That mock is gone, and its removal is the point: it stubbed out
// the one code path that had just crashed a user's app, in all ten suites that
// mount JBrowse, so nothing in the suite could see the bug or its fix.
//
// The race it was avoiding is narrowed rather than gone. The root is detached
// synchronously and destroyed a task later, so an in-flight assembly load that
// lands in between reads a live node; one still in flight after that writes to a
// dead one and warns. Noise, not failure, and the price of running the
// `beforeDestroy` hooks at all — see rootModel's `detach` and ADR-069. Don't
// reintroduce the mock; `tests/rootModelTeardown.test.tsx` and
// `tests/pluginLifecycleHooks.test.tsx` are what hold this closed.

// The URL is set in a state initializer: it runs once per mount, before
// `Loader` renders and reads it, and a render stays pure.
export const App = observer(function App({ search }: { search: string }) {
  useState(() => {
    if (search !== window.location.search) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${search}`,
      )
    }
  })
  return <Loader />
})
