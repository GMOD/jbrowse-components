import { Loader } from '../components/Loader.tsx'

jest.mock('../makeWorkerInstance', () => () => {})

// Destroying the rootModel during React unmount races with pending async work
// in tests and surfaces noisy errors. Production behavior is preserved.
jest.mock('../components/disposeLoader', () => ({
  disposeLoader: () => {},
}))

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
