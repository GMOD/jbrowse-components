---
status: Accepted
summary: "The runtime plugin ABI is generated from the exports maps: a runtime plugin externalizes every subpath every bundled @jbrowse package publishes, each product serves what it bundles, the worker's stub-or-real split is derived per export from the graph of the module that declares it, and a key a host lacks throws naming itself. Supersedes ADR-030 §3 — the built jbrowse-plugin-arg carried 84 files of core, 29 of display-kit and 21 of render-core beside 100 KB of its own code, and nothing in the repo could see it"
---

# ADR-128: The runtime ABI is the exports maps

## Status

Accepted (2026-09-16). Supersedes decision 3 of
[ADR-030](adr-030-render-core-package-static-import-only.md) — the render
API is served now, not bundled — and closes the first two follow-ups in
[reference/PLUGIN_ABI_STABILITY.md](../reference/PLUGIN_ABI_STABILITY.md).
`scripts/generateReExports.ts` is the mechanism; the plugin-facing statement
is the dependencies guide.

## Context

A runtime plugin's build externalizes exactly the specifiers
`ReExports/list.ts` names, and its bundler inlines everything else. The list
named 25 subpaths of `@jbrowse/core` by hand, plus the framework singletons
and Material UI, and the display layer a v5 display is built from was kept off
it on purpose: ADR-030 made `@jbrowse/render-core` static-import-only, so a
plugin would pin a version and rebuild on its own schedule, and
`@jbrowse/display-kit` followed the same doctrine without anyone restating
its premise.

The premise was that a second copy of the package is equivalent to one.
ADR-030's own amendment found the one module of render-core where it is not
(`gpuDevice.ts`) and moved that state onto `globalThis`. display-kit is not a
leaf at all: it exists to read the host's view, palette and chrome, and it
imports 33 subpaths of core that the list did not name. Because the externals
map matches exact keys, every one of those was bundled into the plugin, and
each dragged its relative closure with it.

Read from its source map, the built `jbrowse-plugin-arg` bundle carried:

| Package | Files | Source bytes |
| --- | ---: | ---: |
| `@jbrowse/core` | 84 | 411 KB |
| `@jbrowse/display-kit` | 29 | 179 KB |
| `@jbrowse/render-core` | 21 | 135 KB |
| `@jbrowse/display-ui` | 7 | 18 KB |
| the plugin's own code | 31 | 100 KB |

The 84 core files included `util/index.js` — the whole util barrel, though
`@jbrowse/core/util` was served — `util/tracks.js` with the blob map that
carries a locally opened file to the worker, `ui/PaletteContext.js`, a React
context the host's provider can never reach, `pluggableElementTypes/RpcMethodType.js`,
a second base class, and `util/stopToken.js` from the beta the plugin pinned.
The ledger had met this shape once, for `dataAdapterCache`, and served it.

Nothing in the repo could see it. `component_tests/plugin-vite` installs the
same exemplar into a Vite app, where the bundler dedupes every copy; no check
built a plugin the way the store builds one. And the exemplar the guides teach
from, `example-plugins/score-example`, has the same shape: 33 of its inputs
were workspace source.

Two more facts from reading the 17 store bundles on the same day. No v5-era
bundle reaches a plugin `exports` object; the readers were v4 bundles already
dead through a renderer-era name. Six of the 25 core subpaths on the hand
list are reached by no published bundle, and 13 of the 112 Material UI
component subpaths are.

## Decision

**A runtime plugin externalizes `@jbrowse/*` as a whole, and the host serves
every subpath every bundled `@jbrowse` package publishes.**
`scripts/generateReExports.ts` derives, on `pnpm autogen`:

- `ReExports/list.ts` — the union: the framework singletons and Material UI
  from the hand-written `frameworkModules.ts`, and every `exports`-map subpath
  (or `main`) of every public `@jbrowse` package in jbrowse-web's dependency
  closure, `ReExports/*` excluded. 422 keys over 47 packages.
- `coreModules.generated.ts` / `coreWorkerModules.generated.ts` — the
  `@jbrowse/core` half, which core can serve on its own.
- `products/<p>/src/reExports.generated.ts` and `workerReExports.generated.ts`
  — one pair per product, spreading core's map under namespaces of every
  other package that product bundles. A product names each served package as
  a direct dependency, since pnpm resolves nothing else; the generator fails
  naming the missing one.
- `reExports.generated.json` — every key with its runtime export names and
  the worker verdict, which `check-published-plugins.ts` and the removals
  tables read.

**How a key is served** follows from what a bundler's interop reads. A module
with only a default export is served as that value, since a default import of
a CJS-shaped global reads the value itself; a module with named exports beside
a default is served as the namespace with `__esModule` set, so the interop
reads `.default` rather than wrapping the namespace; a module with no default
is the namespace.

**The worker serves a module for real unless its own source graph names
react-dom, a Material UI component, the data grid or floating-ui** — walked
through workspace packages, stopped at third-party specifiers. Those are the
modules a plugin reads only to render, and a stub carrying the module's export
names stands in. The rule reproduced the hand-kept split exactly once two
edges moved: `ui/theme.ts` imported `createTheme` from the `@mui/material`
barrel, which marked the module every renderer reads as UI, and now imports it
from `@mui/material/styles`. `Object.keys` of the real module under jest is
the oracle for every stub's names (`workerModules.test.ts`,
`products/jbrowse-web/src/reExports.test.ts`).

**A key the host lacks throws at the first read, naming the key.**
`JBrowseExports` is a Proxy over the served map: a scoped or slashed read that
misses is a plugin built against a newer core or against a package this host
does not bundle, and used to fail as `Cannot read properties of undefined`
inside the plugin's own module scope. `PluginLoader.loadSettled` reports it as
one failure.

**The plugin `exports` objects are gone**, and the `@material-ui/*` aliases
with them (one live reader, `jbrowse-plugin-reactome` 1.0.1). What an
`exports` object held is a named export of the plugin package, which the
served list now includes.

**`scripts/check-plugin-porosity.ts` is the gate**, in the post-build CI job
beside the declaration-leak and extension-point checks: it builds the exemplar
with the template's externals and fails on any workspace source in the
metafile.

## Consequences

- Every subpath a package publishes is ABI, and every removal is a diff in a
  committed generated file. The removals table's `assertCovers` fails
  `pnpm autogen --check` on a name the previous release served that the
  manifest no longer does, until a human describes it: that is the gate the
  removals-only `abiBaseline.json` used to be, against a fixed point rather
  than a moving one. `abi.test.ts`, `publicUtil.ts`, `publicTracks.ts`,
  `publicUi.tsx`, `barrelOnlyNames.ts`, `workerNamespaceNames.ts` and
  `sharedModules.ts` are deleted; `@jbrowse/core/ui` is served as its barrel,
  which now exports the lazy `BaseTooltip` published apollo reads off it.
- A served package's version is the host's. A plugin rebuilt against v5
  externalizes display-kit and render-core and needs a v5 host — the "an ABI
  addition is a version floor for the next build" rule from the ledger, at
  package scale. The insulation ADR-030 bought by bundling is given up for the
  display layer, which could not be insulated anyway: its copy reads the
  host's view and session through duck-typed contracts nothing checks.
  render-core goes with it for the one-rule reason; a plugin's generated
  shader is consumed by the host's `slangPass`, which was already the
  contract.
- Products declare the packages they bundle. jbrowse-web gained ten direct
  dependencies it already reached transitively, the circular-genome-view
  build thirteen, among them `@jbrowse/plugin-linear-genome-view`, which
  `sv-core` and `tree-sidebar` had been pulling into it all along.
- The registry chunk grows, and its cost is not confined to the chunk. A host
  whose bundle holds the registry keeps every export of every served module,
  so a module its eager code shares carries all of them onto first paint, and
  under rolldown the ui barrel's namespace spread — the pin EAGER_BUNDLE.md §4
  removed — pins the barrel's Material UI there again. A host that loads no
  plugin avoids both only while nothing it bundles imports a generated map:
  PluginLoader's own `import()` of one did, which put build-your-own ~230 KB
  over budget until the loader moved to the caller (EAGER_BUNDLE.md §3).

## Rejected

- **Serve by prefix at runtime with a lazy registry.** A UMD bundle reads
  `JBrowseExports[key]` at module scope and cannot await, so every served
  module is loaded before the first plugin evaluates. Per-key laziness needs
  the plugin to declare what it reads, which the bundle does not carry.
- **Host the non-core maps in `@jbrowse/product-core`.** One generated pair
  instead of five, but `sv-core` and `tree-sidebar` depend on the linear
  genome view plugin, so product-core would have pulled that plugin into every
  product, and the embedded builds choose their plugin sets on purpose.
- **Keep render-core bundled, serve the rest.** A plugin's own render-core
  copy would then drive backends through the host's display-kit copy's
  `RenderLifecycleMixin`, two copies of one lifecycle held together by
  duck typing. One rule.
- **Classify worker stubs by whether the module's graph reaches react-dom at
  all, node_modules included.** `@mui/material/styles` reaches react-dom
  through `Portal`, which marks `ui/theme.ts`, `pluggableElementTypes/models`
  and the pluggable-element barrel as UI — three modules every adapter plugin
  needs real in the worker. The walk stops at third-party specifiers and names
  the four packages that mean rendering.

## Amendment (2026-09): the worker split is per export

The module-level split stubbed data along with components. A runtime plugin's
worker adapter read `clipSyntenyFeature` off `@jbrowse/synteny-core`, whose
barrel also exports React components, and got a stub back: its records carried
empty coordinates and nothing named the cause. The generator now follows each
export of a rendering module to the module that declares it and serves the
export for real when that module's graph names none of the four packages and no
module on the way both renders and runs code of its own. The worker imports
those exports by name from the key's own specifier, since a product may name
only published specifiers, and `sideEffects: false` keeps the rest of the
graph out. `reExports.generated.json` marks such a module `mixed` and lists
what it still stubs. EAGER_BUNDLE.md §"A rendering module's data names are real
in the worker" has the measurement and the cost.
