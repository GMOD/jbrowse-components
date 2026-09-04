---
name: the-worker-namespace-names-are-typed-out-by-hand
description: workerNamespaceNames.ts is 280 lines of export names the worker serves as stubs, and CORE_UI_NAMES' 128 of them are a verified byte-for-byte duplicate of publicUi.tsx two files away. It cannot be derived at runtime — the worker is the one realm that must not import the UI — so the fold is codegen, with generateConfigManifest.ts as the in-tree precedent. Drift is a red test rather than a silent bug since the parity check moved onto modules.ts, so this is maintenance cost, not risk.
---

# The worker namespace names are typed out by hand

`packages/core/src/ReExports/workerNamespaceNames.ts` lists, per served UI
module, the export names the RPC worker answers with `uiStub`. The worker gets
a namespace with real own keys rather than a bare proxy because esbuild's
`__toESM` copies own keys onto a fresh object — a name that is not an own key
reads as `undefined` at the import site, and a plugin touching it at module
scope throws as it loads.

Measured: `CORE_UI_NAMES` is 128 names and `publicUi.tsx`'s export list is the
same 128, with an empty difference in both directions. `MUI_STYLES_NAMES` is a
third copy of the 44 names `MuiStylesReExports.ts` already writes twice.
`MATERIAL_UI_LAB_NAMES` and `TSS_REACT_NAMES` restate `modules.ts`'s own
`materialUiLabLib` / `tssReact`. Several more blocks are `Object.keys` of a
third-party namespace, typed out.

## Why it is not a one-line derivation

`workerNamespaceNames.ts` is imported by `workerModules.ts`, which is what the
**worker** loads. Importing `publicUi.tsx` there to read its keys would pull
the real components into the worker — the exact thing the stub exists to
prevent, and the eager-bundle budget it protects. So the names have to arrive
as literals; the only question is who types them.

## The fold is codegen

`scripts/generateConfigManifest.ts` is the precedent and solves the same two
problems: it esbuild-bundles the live source with stdin + `resolveDir` (node's
type-stripping refuses `.tsx`, and `@jbrowse/core` only resolves from a package
that depends on it), evaluates it, and writes a `.generated.ts`.
`checkOrWriteAll` gives `--check` for free, so `pnpm autogen` covers it.

The generator would also decide the namespace/single-value split from the
modules themselves rather than from a hand-kept map, which is the part that
went wrong: `@mui/material/SvgIcon` was namespace-shaped on the main thread and
absent from the map, so the worker served the bare stub and dropped
`createSvgIcon` — the one export `@mui/icons-material` needs, and the reason
that entry exists at all.

## Why this is cost and not risk now

The parity test used to iterate `WORKER_NAMESPACE_NAMES`' own keys, so a module
missing FROM the map was invisible to it — which is how the SvgIcon hole
shipped. It now walks `modules.ts` and requires every name a served module
publishes to survive into the worker, so drift surfaces as a red test naming
the missing export. What is left is the transcription: a MUI bump means a
human copying names across, where after codegen it means `pnpm autogen`.

That makes this worth doing deliberately rather than urgently. The minimum
worthwhile cut, if the generator is judged too heavy, is `CORE_UI_NAMES` alone
— 128 of the 280 lines, provably identical to a file in the same directory.
