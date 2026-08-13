import { Loader } from '../components/Loader.tsx'

jest.mock('../makeWorkerInstance', () => () => {})

// disposeLoader used to be mocked to a no-op here, because destroying the
// rootModel during React unmount raced with pending async work and surfaced
// noisy errors. That mock is gone, and its removal is the point: it stubbed out
// the one code path that had just crashed a user's app, in all ten suites that
// mount JBrowse, so nothing in the suite could see the bug or its fix.
//
// The race it was avoiding is gone rather than tolerated — detach no longer
// destroys the root, so an in-flight assembly load lands on a live node (see
// rootModel's `detach`). Don't reintroduce it; `tests/rootModelTeardown.test.tsx`
// is what holds this closed.

export function App({ search }: { search: string }) {
  const currentSearch = window.location.search
  if (search !== currentSearch) {
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${search}`,
    )
  }
  return <Loader />
}
