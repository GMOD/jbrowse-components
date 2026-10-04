---
name: unit-slot
description: "Colin's 2026-10-04 call: the observation unit is one config slot, `unit`, on the alignments display ('read' | 'chain', replacing linkedReads) and the multi-sample variant display ('sample' | 'haplotype', replacing renderingMode), with retired lifts for both old spellings and the v4 share-link state. The order of work, every writer that changes, and the two traps."
---

# One `unit` slot for the observation unit

Colin settled this on 2026-10-04: `unit` is a top-level display slot in the
plot vocabulary, not a member of `facet` (chains apply with no facet, the
facet schema is shared and closed, and `{"facet": null}` would silently drop
chain mode). The `@jbrowse/img` track token renames outright. `isChainMode`
becomes reads of `unit` where that stays cheap, else a getter over it.
Background: ADR-188 (the RPC spells `facet.unit`), ADR-139's amendment (a mode
flag standing in for a unit is a second spelling). Delete this file when the
slot lands on both displays.

## Alignments: `unit: 'read' | 'chain'`

- **Slot**: `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts`
  declares `unit` (enum, default `read`) where `linkedReads` was, with
  `retired: { linkedReads: v => ({ unit: v === 'normal' ? 'chain' : 'read' }) }`
  beside the existing `colorBy` lift. `LINKED_READS_MODES` in `constants.ts`
  and its export in `src/index.ts` become the unit values. `setLinkedReads`
  (`model.ts`) becomes `setUnit`, keeping its swap of the read fill between
  `normal` and `insertSizeAndOrientation`.
- **Readers**: `configSlotViews.ts`, the "View as pairs" row in
  `menus/readConnections.ts`, the split-read jump in
  `viewSplitAlignmentRegions.ts`, the duck types in `menus/contextMenu.ts` and
  `plugins/breakpoint-split-view/src/BreakpointSplitView/util.ts`
  (`linksOwnReads` reads `linkedReads` structurally and would silently read
  `undefined`: change it in the same commit), blat's `IsPcrDialog.tsx`
  `displayDefaults`, and LGV synteny's comment in `LGVSyntenyDisplay/menus.ts`.
- **`isChainMode`**: 45 non-test lines in 13 files and 28 test lines read it.
  Rename the reads to `unit` as a separate commit after the slot; the
  renderer and shader boolean `chainMode` stays, since a uniform is an int at
  the GPU boundary. If that commit does not stay green cheaply, keep
  `isChainMode` as a getter over `unit`.
- **Fetch**: `linkedReads` was never in `rpcProps`; only `isChainMode` reaches
  the fetch (`sortTag`, `facet.unit` through `workerFacet`, `showSoftClipping`),
  so `rpcProps` stays byte-identical. `fetchAutorun.test.ts` pins both cases.
- **Writers to change**: `products/jbrowse-img/src/applyTrackOpts.ts`'s
  `linkedReads:` token becomes `unit:read|chain` (README and
  `website/docs/jbrowse-img.md`); figure specs `cancer_sv.ts`, `sv.ts`,
  `pangenome.ts`, `ui.ts`, `jbrowse-img.ts`; `website/src/lib/spec-recipe/fields.ts`;
  `website/docs/tutorials/display_settings.md`;
  `products/jbrowse-web/browser-tests/suites/alignments.ts`. No `test_data`
  config sets it.

## Multi-sample variant display: `unit: 'sample' | 'haplotype'`

Every change phased mode makes follows from the datum becoming one allele
(haplotype rows in `getSources.ts`/`expandRows`, cell styles, no dosage ramp,
phase-set hue offered, per-haplotype clustering and sort), so `renderingMode`
joins with nothing left over and `shadeByDosage` stays the encoding knob.

- **Slot**: `LinearMultiSampleVariantDisplay/configSchema.ts` declares `unit`
  (default `sample`) with
  `retired: { renderingMode: v => ({ unit: v === 'phased' ? 'haplotype' : 'sample' }) }`.
  `renderingMode` shipped in v4.3.0 as a config slot AND as the
  `renderingModeSetting` display state, so the share-link exception in
  `v5-breaks-compat-no-migrations` applies: add `renderingModeSetting` to the
  `retiredState` in `LinearMultiSampleVariantDisplay/index.ts` (nothing lifts
  it today, which is a standing bug).
- **Readers**: the getter in `shared/MultiSampleVariantBaseModel.ts`,
  `setPhasedMode` (which resets the row arrangement because row names change),
  `rpcProps` (the key renames 1:1, so refetch triggers are unchanged),
  `genotypeMatrixKey.ts`, `variantLegend.ts`, `variantCellStyles.ts`,
  `cellHue.ts`, `multiSampleVariantMenuItems.ts` ("Rendering mode" can read
  "Rows: per sample / per haplotype"), `runGenotypeClustering.ts`'s
  provenance caption, `VariantRPC/types.ts` (typed `string` today).
- **Writers to change**: `test_data/graphgenomeview/hprc.json`,
  `hprc_local.json`, `pangenome_nonhuman.json`, `pangenome_nonhuman_local.json`;
  specs `trio.ts`, `pangenome.ts`; tutorials `pangenome_{hprc,ecoli,cattle,cactus}.md`,
  `ld_human.md`, `user_guides/multivariant_track.md`.

## Shared

- `unit` joins `PLOT_VOCABULARY` (`packages/core/src/configuration/plot.ts`)
  so `activeDisplay.plot` and "Edit plot..." carry it, and `JB_HELP` in
  `packages/app-core/src/JbApi/jbApi.ts` gains one clause (the MCP text caps
  are gated by `pnpm check-mcp-text-caps`).
- `agent-docs/reference/PLUGIN_ABI_STABILITY.md` gets a line: a plugin
  reading `display.linkedReads`, `renderingMode` or `isChainMode` now gets
  `undefined`.
- Tests: a retired-lift test per display that writes the old spelling and
  reads the live display; `ConfigSlotDefaults` snapshot is jbrowse-web's and
  CI fixes it forward.
- Afterwards: ADR-188's table, `mechanisms/split-read-chains.md`, and delete
  `ideas/waiting-on-a-call/linked-reads-slot-is-the-unit.md`.
