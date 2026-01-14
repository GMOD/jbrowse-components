import { Loader } from '../components/Loader.tsx'

jest.mock('../makeWorkerInstance', () => () => {})

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
