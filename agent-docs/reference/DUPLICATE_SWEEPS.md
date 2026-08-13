---
name: duplicate-sweeps
description: What a repo-wide sweep for same-named exports actually turns up, the seven false-positive classes that make up nearly all of it, the four mechanisms this repo already uses to hold a legitimate copy in step, and the one case where deleting a duplicate cost 12 KB of eager bundle. Read before deleting a copy that looks accidental.
---

# Sweeping for duplicates

Three sweeps have now run this over the whole repo. Each found one or two real
things and spent most of its budget re-deriving the same false positives, so
this is the part worth keeping.

## Running it

Scan for names exported from more than one file — `export function|const|class|
let NAME`, skipping tests, `*.generated.ts` and fixture directories, over
`packages/ plugins/ products/`. It returns **117 names** as of 2026-08-13.

That number is not a backlog. Almost all of it is one of the classes below.

## The seven false-positive classes

Check these before opening anything, in roughly descending volume:

1. **Architectural slots.** `stateModelFactory` (31 files), `normalizeSnapshot`
   (38), `renderSvg` (15), `run` (15), `configSchema`, `configSchemaF`,
   `configSchemaFactory`, `doAfterAttach`, `register`, `GuessAdapterF`,
   `createTestEnvironment`, `handler`. The name is the interface. Nothing to
   look at.
2. **Per-product parallel implementations.** `createViewState`, `loadPlugins`,
   `makeWorkerInstance`, `decodeSession`, `RootModel`, `sessionModelFactory`,
   `factoryReset`, `version`, `Loader`, and the whole `examples-site` set. Four
   products deliberately ship four of these.
3. **`export default`.** The name is local to the module, so it never collides
   at an import site. `SetRowArrangementDialog`, `ReorderChromosomesDialog`,
   `GetFeatureDetails`, `f`. For RPC classes the identity that matters is the
   `name` field (`GetPileupFeatureDetails` vs `GetCanvasFeatureDetails`), not
   the class name.
4. **Lazy-import shims.** A module whose entire job is to re-export another
   behind an `import()`, so the eager side never names the lazy one. Desktop's
   `StartScreen/util.tsx` wraps five, and there are `lazyDialogs.ts`,
   `lazyLoginForms.ts` and arc's per-display `renderSvg.tsx`. All say so.
5. **Thin bindings over something already shared.** Two callers configuring one
   shared component or helper: the two `ReorderChromosomesDialog`s both bind
   `synteny-core`'s `DiagonalizeDialog`, dotplot's `getHighlightColor` pins an
   alpha on core's, canvas's `readConfigValue` is a typed wrapper on core's.
   The sharing already happened.
6. **Layer pairs.** Same operation at two representations. `packages/core`'s
   `ui/palette.ts` and `util/color-bits/functions.ts` collide on **four** names
   (`alpha`, `darken`, `lighten`, `getLuminance`) because one works on CSS
   strings and the other on packed uint32. Likewise the free function `bpToPx`
   (within one region, `bpUtils.ts`) versus the view method (across
   `displayedRegions`, `Base1DUtils.ts`).
7. **Copies across a boundary a package genuinely cannot cross.** See below —
   these are real copies, and each already has a mechanism.

## The four mechanisms for a legitimate copy

When the boundary is real, the copy is right and the question is only what
holds the two in step. All four of these are in the repo and worth copying:

- **A test that imports both**, in the one package that depends on both.
  `packages/text-indexing/src/util.test.ts` pins core's browser-safe mirror of
  `indexableAdapters` (core cannot import the indexer: `node:fs`).
  `jbrowse-capture`'s `hub.test.ts` pins its copy of `hubUrl` (its only runtime
  dep is puppeteer; importing core would be the largest thing in the install).
  `jbrowse-web`'s `sessionMetadataParity.test.ts` pins plugin-menus' restatement
  of `SessionMetadata` (a plugin cannot depend on a product package).
- **A typed wrapper that is itself the check.** jbrowse-web's `buildLgvInit`
  wraps app-core's rather than re-exporting it, purely so the return type is
  annotated with the real `InitState` — app-core restates that shape
  structurally, and the wrapper is where the restatement is checked.
- **A comment naming the twin**, where the copy is trivial and frozen.
  `useEventCallback` (render-core cannot depend on core — core depends on it),
  the three `parseStrand`s, the two `useSearchBoxPrefs`.
- **Nothing, deliberately**, when merging costs more than the copy: two
  identical `resolve`s (`new URL(uri, baseUri).href`) in data-management's two
  track-hub connections, `STDIN_ARG` (`'-'`) in the two published CLIs.

**Exact structural equality, not mutual assignability**, when pinning a shape.
Assignability is the obvious spelling and it is too weak for optional fields: an
optional property renamed or dropped leaves both shapes still assignable, so the
check passes while the two disagree. `sessionMetadataParity.test.ts` carries the
`Eq<A, B>` form and the note about why.

## The one that bit

`breakpoint-split-view`'s `components/overlayGeometry.ts` duplicates four
helpers from `../util.ts` to keep an eager module and a lazy one from sharing a
module. A sweep read them as accidental copies and merged three
(`24aba4d012`). tsc, jest and lint all passed; the synteny page went 678 -> 690
KB gzip eager and broke a budget only a full Astro build measures. Restored in
`0e8f92550f`, and the plugin now has `eagerBoundary.test.ts`.

So: **identical trivial copies are the expected shape of a deliberate split, not
evidence against one.** Read the file header before deleting one. Details and
the general rule are in [EAGER_BUNDLE.md](EAGER_BUNDLE.md).

## What the three sweeps actually found

Two real duplicates, both in the first sweep: alignments' `randomColor` (a
char-code-sum palette that reached 36 hues at one saturation, deleted for core's
djb2/oklch one) and breakpoint-split's `isOffscreenLayout` — which was the one
that should not have been merged.

Everything else was a name collision, a documented copy, or a missing pin. The
sweep's yield is low and its cost is a whole session; the useful version of it
is not "find duplicates" but **"find copies whose mechanism is missing"** —
which is a much smaller question, and the one the classes above leave you with.
