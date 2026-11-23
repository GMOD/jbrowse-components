# jbrowse-cli

- **Import `fetch` from `./cliFetch.ts` in every `src/` module**, so
  `jest.mock('../cliFetch')` intercepts it; global `fetch` hits the real API.
- **Mock what `@jbrowse/text-indexing-core` and `@jbrowse/launch-args`'s
  `fetchJson` (`add-assembly --genome`) fetch with `mockGlobalFetch`
  (`testUtils.ts`).** They use global `fetch` on purpose (they also run in the
  desktop indexing worker and other products), and a CLI test's
  `@jest-environment node` docblock skips the fetch mock setup, so an inert
  `mockFetch` there hits the network.
