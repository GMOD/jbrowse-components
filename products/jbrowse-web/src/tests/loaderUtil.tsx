// we use mainthread rpc so we mock the makeWorkerInstance to an empty file

import { QueryParamProvider } from 'use-query-params'
import { WindowHistoryAdapter } from 'use-query-params/adapters/window'

import { Loader } from '../components/Loader'



export function App({ search }: { search: string }) {
  // Jest 30 with jsdom 26+ requires using proper navigation APIs
  // instead of directly mutating window.location
  window.history.replaceState(null, '', search)
  return (
    <QueryParamProvider adapter={WindowHistoryAdapter}>
      <Loader />
    </QueryParamProvider>
  )
}
