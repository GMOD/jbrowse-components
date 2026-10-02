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

## matchMedia is absent on purpose, and a responsive test must say so

There is deliberately no `matchMedia` shim, and a responsive test that does not
install one passes for the wrong reason. jsdom defines no `window.matchMedia`;
MUI's `useMediaQuery` checks for that and returns its `defaultMatches` — `false`
— rather than throwing. So every responsive component takes its wide branch
under test, and a test written against a narrow branch passes just as well
against a component that has no narrow branch at all.

It stays absent because the absence is not only a jsdom gap: a worker, a node
RPC context and an SSR pass genuinely have no `matchMedia`, `animationAllowed`
and `PaletteContext` both guard for exactly that, and their tests exercise it
ambiently. A global shim would erase the condition they are pinning — and
`animationAllowed.test.ts` would then pass only because an earlier test in the
file deletes the shim in its `finally`, so a `-t` run of it alone would fail.

Install one per-test instead and delete it after, which
`RecentSessionsDataGrid.test.tsx`, `animationAllowed.test.ts` and
`PaletteContext.test.tsx` each do. Only `matches` is ever read. The first of
those is the worked example for a width query, and it fails when the component's
narrow branch is removed _and_ when its own stub is.

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

## Emotion class hashes are normalized out of DOM snapshots

Emotion names a class after a hash of its serialized style text, so any MUI
release that edits a shared style object renames every class derived from it.
MUI 9.4.0's `theme.focusVisible` variant on `ButtonBase` reddened all nine DOM
snapshots in the tree that way, with no structural change in any of them, and
three of those had been re-diagnosed and dismissed by hand several times over.

`emotionClassSerializer.cjs` rewrites `css-<hash>` to `css-HASH` and leaves the
rest of the class attribute alone, so the reviewable half —
`MuiButton-contained`, `Mui-disabled`, the MUI slot suffix — still pins. It is
in `snapshotSerializers` on every project, and the uppercase token is what makes
re-serializing an already-normalized string a no-op.

A DOM snapshot recorded before this existed carries raw hashes and fails until
it is regenerated; `jest -u` scoped to that suite is the whole fix.
