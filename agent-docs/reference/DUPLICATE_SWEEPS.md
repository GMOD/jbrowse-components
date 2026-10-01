---
name: duplicate-sweeps
description: What repo-wide duplicate sweeps turn up, their false-positive classes, the four mechanisms that hold a legitimate copy in step, and the deletion that cost 12 KB of eager bundle. Read before deleting a copy that looks accidental.
audience: internal
kind: measurement
---

# Sweeping for duplicates

Repo-wide duplicate sweeps each found one or two real things and spent most of their
budget re-deriving the same false positives. The yield is low and the cost is a
session; the useful question is not "find duplicates" but **"find copies whose
mechanism is missing"**.

## Running it

Scan for names exported from more than one file (`export function|const|class|let NAME`,
skipping tests, `*.generated.ts` and fixture directories, over `packages/ plugins/
products/`). The result is not a backlog: almost all of it is one of the classes below.

## The seven false-positive classes

Check these before opening anything, roughly by descending volume:

1. **Architectural slots**: `stateModelFactory`, `normalizeSnapshot`, `renderSvg`, `run`,
   `configSchema(F|Factory)`, `doAfterAttach`, `register`, `createTestEnvironment`,
   `handler`. The name is the interface.
2. **Per-product parallel implementations**: `createViewState`, `loadPlugins`,
   `makeWorkerInstance`, `decodeSession`, `RootModel`, `sessionModelFactory`,
   `factoryReset`, `Loader`, the `examples-site` set. "Not accidental" is not "cannot be
   shared": a pass through `products/` moved `loadPlugins`' body, the
   `sessionModelFactory` argument type, `useQueryParam` and the embedded sessions' mixin
   set, keeping the genuinely per-product part. **Typing decides how far you get**:
   passing a model type as a generic to `types.compose` degrades the result to `any`
   silently (see the declined `createEmbeddedSessionModel` factory).
3. **`export default`**: local to the module, never colliding at an import site. For RPC
   classes the identity is the `name` field, not the class name.
4. **Lazy-import shims**: a module whose job is to re-export another behind an `import()`
   (desktop's `StartScreen/util.tsx`, `lazyDialogs.ts`, `lazyLoginForms.ts`). All say so.
5. **Thin bindings over something already shared**: both `ReorderChromosomesDialog`s bind
   `synteny-core`'s `DiagonalizeDialog`; dotplot's `getHighlightColor` pins an alpha on
   core's.
6. **Layer pairs**: the same operation at two representations. `ui/palette.ts` and
   `util/color-bits/functions.ts` collide on `alpha`, `darken`, `lighten`, `getLuminance`
   (CSS strings vs packed uint32); free `bpToPx` (one region) vs the view method (across
   `displayedRegions`).
7. **Copies across a boundary a package cannot cross.** Real copies; each has a mechanism
   below.

## The four mechanisms for a legitimate copy

When the boundary is real, the question is what holds the two in step:

- **A test that imports both**, in the one package depending on both.
  `packages/text-indexing/src/util.test.ts` pins core's browser-safe `indexableAdapters`
  mirror (core cannot import the indexer: `node:fs`); `jbrowse-capture`'s `hub.test.ts`
  pins its copy of `hubUrl`; jbrowse-web's `sessionMetadataParity.test.ts` pins
  plugin-menus' restatement of `SessionMetadata`.
- **A typed wrapper that is itself the check**: jbrowse-web's `buildLgvInit` wraps
  app-core's so the return type is annotated with the real `InitState`.
- **A comment naming the twin**, where the copy is trivial and frozen (`useEventCallback`,
  the three `parseStrand`s, the two `useSearchBoxPrefs`).
- **Nothing, deliberately**, when merging costs more than the copy (two identical
  `resolve`s, `STDIN_ARG`).

**Pin a shape with exact structural equality, not mutual assignability**: an optional
property renamed or dropped leaves both shapes assignable. `sessionMetadataParity.test.ts`
has the `Eq<A, B>` form.

## The one that bit

`breakpoint-split-view`'s `components/overlayGeometry.ts` duplicates four helpers from
`../util.ts` to keep an eager module and a lazy one from sharing a module. A sweep merged
three as accidental copies; tsc, jest and lint passed, the synteny page went 678 → 690 KB
gzip eager and broke a budget only a full Astro build measures. Restored; the plugin now
has `eagerBoundary.test.ts`. **Identical trivial copies are the expected shape of a
deliberate split, not evidence against one.** Read the file header before deleting one
([EAGER_BUNDLE.md](EAGER_BUNDLE.md)). A cheap check when a header hints at a boundary: walk
value-imports transitively from the module that must stay light and assert what it cannot
reach (the alignments Canvas2D/SVG renderer reaches zero modules carrying `WGSL_SOURCE`).

## What the sweeps found, and how to read a count

Real finds: alignments' `randomColor` (a char-code-sum palette, deleted for core's
djb2/oklch one), `HeaderSearchBoxes` (44 byte-identical lines in the comparative and
breakpoint split views, moved to `plugin-linear-genome-view`'s barrel that both already
imported, so no new edge or eager bytes), and the tabix shorthand expansion written out by
eight adapters. Everything else was a name collision, a documented copy or a missing pin.

**Run a sweep after a mixin lands, not before, and read a floor of two as the shape
working** (`LegendMixin` and `TreeSidebarMixin` took the `showLegend` and tree-toggle
triples). **But a floor of two is evidence only when the pattern covers every spelling of
the read**: `rowHeight` read as two displays until the scan included `readConfObject(self.conf,
…)`, because canvas declares a typed `get conf()` over `self.configuration` and
`getConf(self, 'x')` **is** `readConfObject(self.configuration, 'x')`. Grep the accessor
*sugar* (`getConf` / `readConfObject`; receivers `self`, `self.conf`, `self.configuration`)
before trusting a count. `RowHeightMixin` took the triple. The **interface** tell is
cheaper than any scan: duck-typed contracts that precede their mixins are listed in
ARCHITECTURE.md (`rowHeightMenu.ts` already restated `RowHeightModel`).

## The other scan: structural, not by name

A clone detector (normalize each `.ts` to non-blank non-comment lines, slide an 8-line
window, hash, report windows in more than one file) finds renamed copies. **Filter import
statements first** or the top ten are files importing the same constants. Its false
positives are body-shaped:

- **Declarative config**: adapter `configSchema.ts` files dominate.
- **N implementations of one public interface**: the five view models each declare a
  one-line `loading` getter over core's `viewLoading` and four a `status` over
  `computeViewStatus`. Five declarations are five conformances; a mixin would move their
  per-view doc rows off the pages that should carry them.
- **Residue of already-shared helpers**: three RPC executors share a preamble
  (destructure args, `getFeatureAdapterOrThrow`).

**This scan is MORE prone to the eager-bundle trap than the name scan**: byte-identical
bodies are exactly what a deliberate module split produces. Before merging any copy, read
the **file header**, not just the comment at the duplication (there the header stated the
rule in bold twenty lines up while the nearby comment only said the copies mirror each
other).
