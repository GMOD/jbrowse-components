# Active Work Items

**Updated:** 2026-04-14 | Move completed items to `agent-docs/completed/COMPLETED.md`.

---

## Infrastructure

**GPU: Build-time WGSL struct size validator**  
Add Jest test that parses WGSL and asserts `sizeof(instanceStruct) % 16 === 0`.
Currently only caught at runtime in `WebGPUHal.create`.

**Migrate to pnpm 11** (when released)  
Remove `"pnpm"` from `package.json`, update `pnpm-workspace.yaml`, replace
`pnpm install --frozen-lockfile` with `pnpm ci` in CI, bump
`pnpm/action-setup` version to 11.

---

## Display Types

**HiC and LD multi-region upload**  
Switch from single-region to per-region pattern: `rpcDataMap: Map<number, Data>`,
use `uploadChangedRegions`, pass `regionNumber` to `renderer.uploadRegion()`,
pass block array to `renderBlocks()`.

**MultiVariantDisplay per-region optimization**  
Check if `computeVariantCells` preserves object identity for unchanged regions,
then wire up `uploadChangedRegions` to skip redundant uploads.

---

## Features & UX

**Alignments curved read links**  
Reuse breakpoint split view logic in new "Link with curved lines" mode.

**Synteny viewport culling**  
LOD improvements for large comparisons (Hs1 vs mm39 slow). Widen margins or
soften refetch criterion.

**Canvas offscreen buffer**  
Add margin rendering to avoid feature re-juggling on small zooms (like
`plugins/sequence`).

**Dotplot re-render**  
Initial render works; subsequent updates lost. Debug lifecycle.

**Protein3D on linearbasicdisplay**  
Consolidation removed it; may need separate display or restoration.

**Alignments menu reorganization**  
Collapse rarely-used options (max height, toggles) into submenu.

**Breakpoint connectors**  
Smooth out awkward blue/green curves (currently arbitrary Y increase/loop).

**Synteny/dotplot UX**  
Linked views, swap axes, better defaults for human vs mouse.

**Gene glyph compact modes**  
Add super-compact for dense layouts; side labels for genes.

**Paired arcs visibility**  
Non-downward-pointing arcs fail to render.

**Long-range inter-region arcs**  
Add UI toggle to draw arcs between distant regions.

---

## Performance & Stability

**Test speed & stability**  
Browser test suite slow; some flaky tests. Reduce runtime, fix failures.

**Scroll zoom lag**  
~500ms–1s delay after tab switch. Debug LinearGenomeView reactivity or JS
event throttling.

**Canvas SNP cutoff**  
Remove SNP clickmap at megabase zoom levels (no reason to render).

**Verify `?renderer=X` param**  
Check URL parameter functioning.

---

## Config & Sessions

**Global config overrides**  
Admin-level defaults (e.g., show paired arcs by default) across all tracks.

**Hash password in share links**  
Password only needed at startup (read then deleted). Store in URL hash,
clear on first navigation.

**LGVSyntenyDisplay "Query name" coloring**  
Re-implement removed color-by-query-name (hash to color).

---

## Polish

**Dark reader compatibility**  
Multiwiggle/DNA rendering with light backgrounds.

**Fix prettier config**  
Unwanted quote/semicolon insertion (see ~/src/mysetup.nvim).

**Feature padding & crowding**  
Right-side canvas padding excessive? Subpixel drawing crowded?

**Show descriptions toggle**  
Toggling should trigger re-layout (currently doesn't).

---

## Unclear (Verify)

- Methylation mode broken?
- Clustering UI not updating?
- Long-range arcs missing in 1kg demo?
