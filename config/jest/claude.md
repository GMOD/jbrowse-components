# Jest Configuration

## Shims exist so production code doesn't branch on the environment

`requestIdleCallback.js`, `scrollIntoView.js`, `resizeObserver.js`,
`pointerEvents.js`, `blob.js` and `localStorage.js` each fill a jsdom gap that
previously had a `typeof jest === 'undefined'` guard sitting in `packages/`
source. Prefer adding a shim here over reintroducing one: a guard in production
source ships a branch nothing in production ever takes, and it forces
`types: ["jest"]` on every project that compiles that file.

Which list a shim belongs in follows from when the value is read: `setupFiles`
runs before the module graph is imported, so anything captured at module-eval
time (`rIC` resolves `window.requestIdleCallback` once) must be installed there.
`setupFilesAfterEnv` is where `beforeEach`/`jest.mock` are available, so
per-test resets (`localStorage.js`, `deterministicIds.js`) go there.

## Fill a jsdom gap; don't swap the type out from under it

`blob.js` is the worked example. jsdom's Blob has no `text`/`arrayBuffer`/
`stream`, and the first fix was to install node's Blob as the global in
`jsdomWithFetch.cjs` — which broke jsdom's `FileReader`, because it brand-checks
its argument and accepts only its own realm's Blob. One realm has to own a type
the DOM APIs consume; fill the methods it is missing rather than replacing it.
`jsdomRealms.test.ts` pins both halves, including what the choice costs.

## Console warning filters

`console.js` filters expected warnings at test startup to keep test output
clean. Warnings are filtered _globally_ rather than per-test because the jest
wrapper captures `originalWarn` in a closure — per-test
`jest.spyOn(console, 'warn')` spies cannot intercept warnings that bypass
through the captured reference.

To silence an expected warning: add a string check to the `console.warn` filter
in `console.js` (e.g. `r.includes('your warning text')`). Document in the code
why it's expected (e.g., "ldToIndex.test.ts: index SNP not found is the expected
test case").
