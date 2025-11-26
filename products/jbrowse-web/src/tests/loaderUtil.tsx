// we use mainthread rpc so we mock the makeWorkerInstance to an empty file

import { useMemo } from 'react'

import { QueryParamProvider } from 'use-query-params'

import { Loader } from '../components/Loader'

import type { QueryParamAdapterComponent } from 'use-query-params'

jest.mock('../makeWorkerInstance', () => () => {})

// Custom test adapter that captures the URL at component creation time.
// This avoids issues with use-query-params v2.2.2+ WindowHistoryAdapter
// which triggers re-renders on URL changes
// (see https://github.com/pbeshai/use-query-params/pull/296)
function createTestAdapter(search: string): QueryParamAdapterComponent {
  return function TestAdapter({ children }) {
    const adapter = useMemo(
      () => ({
        replace() {},
        push() {},
        get location() {
          return {
            search,
            pathname: window.location.pathname,
            state: undefined,
          } as Location
        },
      }),
      [search],
    )
    return children(adapter)
  }
}

export function App({ search }: { search: string }) {
  const TestAdapter = useMemo(() => createTestAdapter(search), [search])
  return (
    <QueryParamProvider adapter={TestAdapter}>
      <Loader />
    </QueryParamProvider>
  )
}
