# jbrowse-cli

- **Import `fetch` from `./cliFetch.ts` in every `src/` module**, so
  `jest.mock('../cliFetch')` intercepts it; global `fetch` hits the real API.
- **Mock what `@jbrowse/text-indexing-core` fetches with `mockGlobalFetch`
  (`testUtil.ts`).** It uses global `fetch` on purpose (it also runs in the
  desktop indexing worker), and a CLI test's `@jest-environment node` docblock
  skips the fetch mock setup, so an inert `mockFetch` there hits the network.
