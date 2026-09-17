---
name: worker-reexport-per-export-stubs
description: Three rounds landed on 2026-09-17 that make the RPC worker serve a UI-bearing ABI module's data exports for real (per-export classification, 15 moved exports, a by-name import walk), grew the worker registry about 16% gzipped for one known consumer, and are proposed for revert. Records why it was built, what it cost, the case for and against, and the revert plan. Read before touching scripts/generateReExports.ts, uiStub.ts or the worker registry, and before giving a runtime plugin a core package's data helpers in a worker.
---

# Worker re-export stubs: per-export classification, and the proposed revert

Colin has not decided. He questions the premise, since he dislikes cross-plugin
imports in general, so nothing below is agreed. **Delete this file once the
decision is made and carried out.**

## The failure that started it

The graph genome plugin (`~/src/jb2plugins/jbrowse-plugin-graphgenomeviewer`)
clips GBZ lane alignment records inside an RPC worker adapter. It called
`clipSyntenyFeature` and `getAlignmentOps` from `@jbrowse/synteny-core` through
the host's ABI (`self.JBrowseExports`). The worker serves any ABI module whose
graph reaches a UI library as `uiStub` (`packages/core/src/ReExports/uiStub.ts`):
a Proxy that returns itself from every call and `''` from toPrimitive. The
synteny-core barrel also exports React components, so the whole barrel was a
stub, every clipped record came back with stub coordinates, and the lane track
failed with `start and end must be numbers. start:  end:`. Nothing named the
stub.

It surfaced only after ADR-128 (`8b5349d743`, 2026-09-16), which generated the
ABI from the packages' `exports` maps and put synteny-core, sv-core,
tree-sidebar and display-ui in it. Before that, a plugin bundled its own copy of
those packages.

The plugin fixed itself first (plugin commit `5d05a20`): it imports the two
source files directly, so esbuild bundles them. That works only through the
plugin's local link to this checkout; published synteny-core exports just `.`.

## What landed in core

A handoff line said the gap was "worth raising in core", and it was built
without first measuring who else hits it. All pushed to main:

1. `453e2dcc18`, `ff0debaa64`: `scripts/generateReExports.ts` classifies per
   export. A UI-bearing module becomes `mixed`: exports declared in a module
   that reaches no UI library are served for real, the rest stay stubs.
   `scripts/measureRegistryBundle.ts` switched to counting only what esbuild
   keeps.
2. `e94c024cff`, `74c02505c4`, `17e05534ec`: 15 data exports moved out of
   rendering files into their own modules (names unchanged), and a guard,
   `products/jbrowse-desktop/src/workerReExports.test.ts`, with a 53-name
   `STAYS_STUBBED` allowlist.
3. `735e65f9a6`, `b11200f22f`: `scripts/reExportReach.ts` (349 lines) follows
   imports by binding name, with a rule counting a Material icon as UI only in
   a module that already renders.

## Consequences

- **Bytes.** 559 names went from stub to real. The worker registry grew about
  437 to 505 KB gzipped in round 1 and 6943 to 7058 KB unminified in round 3;
  one independent re-measurement on a single method gave 5681 to 7058 KB
  unminified and 441 to 513 KB gzipped. UI bytes in the worker did not change.
  Round 1 changed the counting method, so `registryBundleSizes.json` before
  `ff0debaa64` does not compare with after. Only sessions whose config names a
  runtime plugin load the registry (`packages/product-core/src/rpcWorker.ts`).
- **Machinery.** About 580 lines of generator code modelling bundler
  side-effect rules, plus the hand-kept allowlist.
- **Model.** `mixed` modules are what `76cb54165d` refused (a module "neither
  wholly shared nor wholly UI"). ADR-128 replaced that model without restating
  the rule; `EAGER_BUNDLE.md` and the `check-published-plugins.ts` header still
  give the old reason.
- **Unaffected.** ADR-043's 2.2 MB of UI that workers parse through
  `corePlugins.ts` is a separate path.

## Need, measured

- None of the 13 plugin-store bundles reads a formerly stubbed data function in
  worker context. That proves little: the affected modules joined the ABI on
  09-16, so no published bundle could take them from the host yet.
- In `~/src/jb2plugins`, the graph plugin is the only worker-side reader, for 2
  of the 559 names.

## The case for keeping it

Since ADR-128 a template plugin takes `@jbrowse/*` from the host, and a third
party cannot cleanly bundle a data helper instead: the published `exports` maps
expose only the barrel, so bundling means importing unpublished file paths.
Per-export serving closes that gap for every such helper at once.

## The case against

The need is one plugin and two names, bought with a 16% heavier registry and a
generator that models bundler semantics. Colin's objection goes further: a
plugin reaching into another package's internals for its data code is the
coupling to avoid, so the graph plugin owning its clip code may be the right
end state rather than a workaround.

## Proposed plan (from the Opus review, not yet approved)

1. In a worktree, revert `b11200f22f`, `735e65f9a6`, `74c02505c4`,
   `ff0debaa64`; regenerate (`pnpm autogen`) rather than revert `17e05534ec`.
   Keep the pure moves `453e2dcc18` and `e94c024cff`. Gate: the generator,
   `measureRegistryBundle.ts` and `uiStub.ts` match `453e2dcc18^`.
2. Diff each product's `workerReExports.generated.ts` against `453e2dcc18^`: no
   name changes between stub and real, and worker UI bytes at the old value;
   otherwise revert the offending move too.
3. Make stubs label themselves: toPrimitive returns
   `[RPC worker UI stub: <specifier>#<name>]`, and calls stay silent. **Never
   throw**: Apollo 1.1.2's bundled emotion `styled` stringifies stub
   displayNames at load. Gate: `check-published-plugins.ts --check` unchanged,
   and a test pinning the label.
4. Either add worker-safe subpaths (`@jbrowse/synteny-core/clipSyntenyFeature`,
   `/featureAlignmentOps`), which the whole-module rule already serves for
   real, as tree-sidebar's `./clusterMatrix` does; or, if cross-package imports
   stay unwanted, add none and have the graph plugin vendor its clip code
   rather than import `@jbrowse/synteny-core/src/...` through the local link.
5. Update the graph plugin to match step 4, and confirm the HPRC CFH lanes draw.
6. Docs: one sentence in `imports_and_reexports.md` and `EAGER_BUNDLE.md` on
   what a worker gets from a UI-bearing module, and a Rejected row on ADR-128
   for per-export classification with the numbers above.

Success: the worker registry back to about 440 KB gzipped, the generator
machinery gone, and a stubbed read failing with a message that names it.
