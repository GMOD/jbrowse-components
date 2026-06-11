# TODO — action items

Concrete, actionable work. Fanciful / exploratory directions live in
[OTHER_IDEAS.md](OTHER_IDEAS.md). Stable reference docs: [PRD.md](PRD.md),
[ARCHITECTURE.md](ARCHITECTURE.md), [CONFIG_PATTERN.md](CONFIG_PATTERN.md),
[VIEW_INIT.md](VIEW_INIT.md), [TEST_INFRASTRUCTURE.md](TEST_INFRASTRUCTURE.md).

## Quick items

- regenerate embedded examples
- circular view filter sv types / sv-inspector filterings
- hic testing
- reversed region testing
- hide sashimi arcs option if not relevant?
- show outlines autohide
- more 'group operations'
- `fullpage_arcs-collapse-introns-sashimi.png` needs scroll-down to see the collapsed arcs
- does the yeast demo really need remote?
- no max height react-app
- persistent no-close cascading submenu for sub-selecting multiple items
- jest "worker failed to exit gracefully" — chase leak with `--detectOpenHandles` / ensure timers `.unref()`
- gccontent track in `config_demo`
- copy and edit track settings
- fix fallow recommendations
- choose renderer backend via preferences
- sort by genotype hom/het/ref
- sort by modifications

## Active plans

### Arc renderer removal (LinearArcDisplay)

Drop `plugins/arc/src/ArcRenderer/` and run `LinearArcDisplay` through the same
direct whole-view fetch + SVG path `LinearPairedArcDisplay` already uses (part of
"renderer concept goes away with the webgl refactor"). Templates: copy
`LinearPairedArcDisplay`'s `model.ts` / `fetchChains.ts` / `afterAttach.tsx` /
`components/Arcs.tsx` / `components/ReactComponent.tsx`; compose
`BaseDisplay + TrackHeightMixin + FeatureDensityMixin` (drop `BaseLinearDisplay`).

- Inline ArcRenderer's config slots (`color`, `thickness`, `label`, `height`,
  `caption`, `displayMode`) into `LinearArcDisplay/configSchema.ts`; drop the
  `renderer` slot.
- Pull semicircle/bezier path logic (`getSemicirclePath`/`getBezierPath`) from the
  old `ArcRenderer/ArcRendering.tsx` into the new single-feature `Arcs.tsx`.
- Delete `ArcRenderer/` + its `ArcRendererF` registration + the snapshot test.
- **Latent bug to fix in passing:** `LinearPairedArcDisplay/model.ts` still reads
  the stale `getConf(self, ['renderer', 'displayMode'])` after PairedArc lost its
  `renderer` slot. Correct: `self.displayMode ?? getConf(self, 'displayMode')`.
- Verify: tsgo, `pnpm test plugins/arc`, browser smoke (arcs + semicircles modes,
  tooltip, color/thickness config edits).
- Deferred follow-up: `LinearBareDisplay/model.ts` is the other live-CoreRender
  consumer; once both migrate, drop `rendererTypeName`/`rendererType` from
  `BaseDisplayModel` and tighten/delete `CoreRender`/`CoreGetFeatureDetails`.

### MAF UCSC parity — Stage 2 + verification

Stage 1 done (e/i line parse+render via Canvas2D overlay; index-based data-volume
gate). The `bigMafSummary` zoom-out machinery has **largely landed** (swappable
`summaryAdapter` frozen sub-adapter slot on `BigMafAdapter`, `LinearMafGetSummaryData`
RPC, `summaryBars` overlay, real fixture `cactus447way.summary.bb`) but is unverified
and incomplete:

- **Browser-verify the summary path** — pixels + the summary↔detail mode switch
  against a real summary-configured track (hg38 multiz470way / cactus447way).
  Species `src` must match configured `samples[].id` (`rowIndexBySrc` drops
  non-matches silently → blank bars, not a crash). First thing to check if zoom-out
  renders blank.
- **Browser-verify e-lines** — parsing/rendering are unit-tested only; no e/i
  fixture in repo (volvox=MafTabix, evolverMammals=TAF, neither carries e/i). Point
  a track at a real UCSC multiz/cactus `.bb`.
- **Coverage band at summary zoom** — currently empty (reads alignment `rpcDataMap`,
  cleared in summary mode). Wire species-count depth, ideally from bigBed zoom levels.
- Deferred: q-line (quality) rendering; e/i for MafTabix/TAF (needs encoding+tooling
  changes, not just viewer).
- Verify: `pnpm test plugins/maf plugins/bed`, tsgo, eslint.

### DisplayChrome — browser smoke tests

Unification landed (10/10 LGV GPU displays on `DisplayChrome`; competing wrappers
deleted; testid `-done` + view-in-model leak both DONE). Remaining is browser
confirmation of jsdom-only behavior changes:

- **Variant force-load cycle** (highest value): zoom to too-large on multi-variant /
  variant-matrix → force load → canvas re-renders cleanly (no blank/detached canvas).
  Proves the old `visibility:hidden` special-casing was artificial (ADR-025).
- **Loading overlay timing**: shows on pan/zoom fetch, hides on first paint; LD with
  triangle toggled off shows NO overlay (empty-state, fetches nothing).
- Run `products/jbrowse-web/browser-tests` GPU-display tests, diff goldens.

### UCSC multi-genome hub: auto-add missing assemblies (bug)

`plugins/data-management/src/UCSCTrackHubConnection/doConnect.ts` — the multi-genome
(`genomes.txt`) branch pushes unknown assemblies to `notLoadedAssemblies` and skips,
so connecting a standard multi-genome hub against an instance lacking those assemblies
loads **zero tracks**. The single-file branch already does the right thing
(`generateAssembly` → `addSessionAssembly`). Mirror it.

- Confirm `generateAssembly` handles the per-genome `GenomesFile` shape (twoBitPath /
  description / defaultPos); may need a variant for the genomes.txt shape.
- Resolve the sequence location against `genomesBaseUri` (not `hubUri`).
- Keep the `addSessionAssembly?.` guard; decide behavior when absent.
- Respect the connection's `assemblyNames` filter (as the track loop does).
- Add a test in `AddConnectionWidget.test.tsx` (multi-genome hub, no preloaded
  assembly → assembly + tracks added). JB2 connection auto-adds assemblies too —
  another reference for the UX.

### Cross-product model-type audit — P2/P3/P4

P1 (root models) done: all three roots compile-time-checked against contracts,
undo/redo menu items deduplicated, thin `BaseWebRootModel` deliberately skipped.
Apply the same lens (cross-product duplication, `XConfigModel` naming convention,
do NOT relitigate the `self as typeof s & BaseSession` cast) to:

- **P2 config models** (next; bounded): `product-core/RootModel/createConfigModel.ts`
  + the two react products' `createConfigModel.ts`. Look for `getParent<any>` vs the
  typed `JBrowseModelParent`, shareable config getters, named `…ConfigModel` aliases.
- **P3 view models** (read-only consistency audit): confirm each of the 19 repo-wide
  `as typeof s & …` casts is the sanctioned equilibrium; flag any view that split
  `.views()`/`.actions()` across files.
- **P4 displays/connections/internet-accounts/widgets**: typed-reads is a known dead
  end for displays — audit the `<name>Override` field / bare `<name>` getter
  convention across the ~28 `getConfWithOverride` sites instead.
- **react-app contract gap (needs a decision):** react-app's root satisfies neither
  web contract — its `BaseWebSession` delegates `history` + 5 session-DB actions to a
  root that lacks them (works today only because the embedded use never invokes them).
  Options: A harden (add mixins/stubs), B split the contract, C document only.

### Typed config reads — opportunistic adapter rollout

Infrastructure landed: `BaseAdapter<CONF>` / `BaseFeatureDataAdapter<CONF>` /
`BaseSequenceAdapter<CONF>` generic, `getConf` typed off the concrete schema (default
`AnyConfigurationModel` → fully back-compat). Convention: each `configSchema.ts`
exports `export type XConfig = Instance<typeof schema>`; opt a class in via the generic
param, drop now-redundant **scalar** annotations. Many plugins already converted
(bed, comparative-adapters, alignments, sequence, gtf/gff3, wiggle, variants,
gccontent, maf, config). Do the rest opportunistically when touching the file:

- Remaining scalar opt-ins: ~remaining `BaseFeatureDataAdapter`/`BaseAdapter`
  subclasses, text-search adapters. `SplitVcfTabixAdapter` done.
- **Deferred (inheritance conflict):** `IndexedFastaAdapter`/`BgzipFastaAdapter`,
  `BamAdapter`/`HtsgetBamAdapter` resolved via `readConfObject(this.config as unknown
  as XConfig, …)`; `PAFAdapter`/`ChainAdapter`/`DeltaAdapter`/`MashMapAdapter` have
  zero scalar casts to drop — leave until touched.
- Non-scalar slots (fileLocation / stringArray / frozen) stay `any` by design — don't
  force-type. Don't loosen `AnyConfigurationModel` (load-bearing).
- Display `ConfigOverrideMixin<CONF, EXTRA>` is generic (Phase 1: key-name validation
  on opt-in; `LinearHicDisplay` opted in). Remaining displays stay untyped — generic
  factories resolve slot names to `string` inside the body, so threading `<SCHEMA>`
  surfaces zero validation. Only worth it when a display is built concretely.

### View init — known warts (see VIEW_INIT.md)

- `highlight` field leaks the wire format — accept `(string | HighlightType)[]`.
- Consolidate the duplicated InitState field list across its ~6 definition sites.
- `createViewState` drops `highlight` when `location` is absent — preserve it.
- Replace the `tracklist` 500ms width-race timeout with real settling logic.

### Screenshot review — final cleanup

Review loop nearly closed (fixes done + verified). Remaining:

- Re-review changed shots; run `pnpm review-screenshots-web` to clear verdicts.
- Light caption pass on stale text in `dotplot_view.md:18` and
  `sv_visualization_cgiab.md:246`.
- Open judgment calls: multisv, skbr3_translocation, inverted_duplication captions.

### Track/Display cleanup (deferred)

Naming is clarified and the legacy block-based render path is kept indefinitely. The
only open item is deleting `BasicTrack` (alias of `FeatureTrack`), which needs a
track-type alias mechanism in `pluggableMstType` + a back-compat test for loading
`BasicTrack` from saved sessions first. Deprioritized — revisit only if the alias
mechanism gets built.

## Known issues to verify

| Issue                             | Status               |
| --------------------------------- | -------------------- |
| Hot reload breaks canvas features | Investigate          |
| Dockview right-side move          | Non-WebGL bug        |
| Frozen objects (umd_plugin.js)    | Handle read-only     |
| Zoom to full (synteny)            | Verify               |
| Indel colorize toggle             | Verify               |
| Synteny diagonalization (grape)   | Verify (works yeast) |

## Known limitations (blocked / by-design)

- **Label show/hide triggers RPC refetch.** `showLabels`/`showDescriptions` flow
  through `rpcProps()` so toggling them refetches, even though worker output doesn't
  depend on label placement. Blocked by `ConfigOverrideMixin` reactivity (mobx
  subscribes to the whole frozen `rpcProps` object; destructuring label fields out
  doesn't help). Partial mitigation via ADR-006: refetch still fires but
  `rawRpcDataMap` is no longer cleared, so labels don't visually disappear.
