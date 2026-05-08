// Test-only overrides for SWR's process-global state.
//
// (1) Clear the cache after each test. SWR caches resolved fetches across
//     the whole process; without this, a later test reuses a prior test's
//     resolved value and the test's fetcher mock is never invoked.
//
// (2) Disable the 2s dedupingInterval. Two consecutive renders of the same
//     SWR key within 2s reuse the first render's in-flight promise — even
//     if the cache was cleared between tests — because the dedup tracking
//     lives outside the cache map. In production deduping is desirable; in
//     tests it leaks state across `it` blocks.
//
// Both fixes target jest's process-shared global state and have no
// production effect (useFetch.ts ships unchanged).
import { cache, defaultConfig } from 'swr/_internal'

defaultConfig.dedupingInterval = 0

afterEach(() => {
  cache.clear()
})
