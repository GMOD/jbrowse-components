import { QueryParamProvider } from 'use-query-params'
import { WindowHistoryAdapter } from 'use-query-params/adapters/window'

import { Loader } from '../components/Loader'

export function App({ search }: { search: string }) {
  const location = {
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
    ...window.location,
    search,
  }
  Object.defineProperty(window, 'location', {
    writable: true,
    value: location,
  })
  return (
    <QueryParamProvider adapter={WindowHistoryAdapter}>
      <Loader />
    </QueryParamProvider>
  )
}
