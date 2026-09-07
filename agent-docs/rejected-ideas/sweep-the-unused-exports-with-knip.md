---
name: sweep-the-unused-exports-with-knip
description: Sweep the unused exports with knip
area: tooling-tests-and-docs
---

# Sweep the unused exports with knip

run 2026-08-25 and closed on its own
terms: the answer is "there is no exports problem here", not "nobody has
looked". knip 6.32.2, configured per workspace with `src/index.ts` as each
package's entry and tests and benches excluded, reports **99 unused value
exports** on a clean tree. Roughly 85 of them fall in four classes that are
all correct code: `*.generated.ts` shader interfaces, where `pnpm gen:shaders`
emits a full getter/setter pair per instance field whether or not a pass reads
it (~60 of the 99); `packages/core/src/ReExports/publicUtil.ts`, whose several
hundred names are the published `coreUtil` ABI by construction; the vendored
`color-bits` and `react-colorful` shims; and compile-time assertion types
(`_AssertSessionModel` and friends), which appearing once is what they are
for. The residue is about 14 names — `WorkspaceContainer`/`LayoutRenderer`/
`useLayoutDrag`, `Dotplot1DView`, `getPropertyType`, `panSNSample`,
`LABEL_FONT_SIZE`, `INSERTION_SERIF_MIN_PX_PER_BP`, two pass-through
re-exports in `RenderFeatureDataRPC/renderConfig.ts` — none of which is a bug,
and most of which are published subpaths where removal is an ABI break
(PLUGIN_ABI_STABILITY.md). **Do not add knip to `pnpm check-docs`**: a gate
reporting 99 findings on a clean tree teaches everyone to skip it, and
suppressing the four classes means maintaining an ignore list longer than the
signal.
