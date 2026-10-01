---
name: duplicate-sweeps
description: What repo-wide duplicate sweeps turn up, their false-positive classes, the mechanisms that hold a legitimate copy in step, and the deletion that broke the eager bundle. Read before deleting a copy that looks accidental.
audience: internal
kind: measurement
---

# Sweeping for duplicates

Repo-wide duplicate sweeps each found one or two real things and spent most of
their budget re-deriving false positives. The useful question is not "find
duplicates" but **"find copies whose mechanism is missing"**.

## False-positive classes

Name collisions across files are almost all one of these:

1. **Architectural slots**: `stateModelFactory`, `renderSvg`, `run`,
   `configSchema`, `register`, `handler`. The name is the interface.
2. **Per-product parallel implementations** (`createViewState`, `loadPlugins`,
   `sessionModelFactory`). "Not accidental" is not "cannot be shared", but
   **typing decides how far you get**: passing a model type as a generic to
   `types.compose` degrades the result to `any` silently.
3. **`export default`**: local to the module. For RPC classes the identity is
   the `name` field.
4. **Lazy-import shims** and **thin bindings over something already shared**.
5. **Layer pairs**: the same operation at two representations, such as
   `ui/palette.ts` and `util/color-bits/functions.ts` (CSS strings vs packed
   uint32), or free `bpToPx` (one region) vs the view method (across
   `displayedRegions`).
6. **Copies across a boundary a package cannot cross.** Real copies; each needs
   a mechanism below.

## What holds a legitimate copy in step

- **A test that imports both**, in a package depending on both:
  `packages/text-indexing/src/util.test.ts` pins core's `indexableAdapters`
  mirror (core cannot import the indexer: `node:fs`); jbrowse-web's
  `sessionMetadataParity.test.ts` pins plugin-menus' `SessionMetadata`.
- **A typed wrapper that is itself the check**: jbrowse-web's `buildLgvInit`
  annotates its return with the real `InitState`.
- **A comment naming the twin**, where the copy is trivial and frozen.
- **Nothing, deliberately**, when merging costs more than the copy.

**Pin a shape with exact structural equality, not mutual assignability**: a
renamed or dropped optional property leaves both shapes assignable.
`sessionMetadataParity.test.ts` has the `Eq<A, B>` form.

## The one that bit

`breakpoint-split-view`'s `components/overlayGeometry.ts` duplicates four helpers
from `../util.ts` to keep an eager module and a lazy one apart. A sweep merged
three as accidental copies; tsc, jest and lint passed, and the synteny page
broke an eager-bundle budget only a full Astro build measures. The plugin now
has `eagerBoundary.test.ts`. **Identical trivial copies are the expected shape
of a deliberate split, not evidence against one.** Read the file header before
deleting one ([EAGER_BUNDLE.md](EAGER_BUNDLE.md)).

## Reading a count

**Run a sweep after a mixin lands, not before, and read a floor of two as the
shape working.** A floor of two is evidence only when the pattern covers every
spelling of the read: `getConf(self, 'x')` **is**
`readConfObject(self.configuration, 'x')`, and canvas declares a typed
`get conf()`, so grep the accessor sugar (`getConf` / `readConfObject`;
receivers `self`, `self.conf`, `self.configuration`) before trusting a count.

## The structural scan

A clone detector (non-blank non-comment lines, 8-line window, hash) finds renamed
copies. **Filter import statements first.** Its false positives are
declarative config (`configSchema.ts`), N conformances to one public interface
(the per-view `loading` / `status` getters over core's helpers, which a mixin
would pull off the pages that document them), and the residue of
already-shared helpers. **This scan is MORE prone to the eager-bundle trap than
the name scan**: byte-identical bodies are exactly what a deliberate module
split produces. Read the **file header**, not just the comment at the
duplication.
