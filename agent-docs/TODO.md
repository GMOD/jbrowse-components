# TODO — action items

Work to **build or fix** lives here. Items that only need a **browser smoke test
or manual confirmation** are gathered under [Pending verification](#pending-verification)
— and *how* to run those tests lives in
[TEST_INFRASTRUCTURE.md](TEST_INFRASTRUCTURE.md), not here.

Fanciful / exploratory directions live in [OTHER_IDEAS.md](OTHER_IDEAS.md).
Stable reference docs: [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[CONFIG_PATTERN.md](CONFIG_PATTERN.md), [VIEW_INIT.md](VIEW_INIT.md).

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

### Drop CoreRender from BaseDisplayModel (deferred follow-up)

Arc displays are now off the renderer concept (LinearArcDisplay + PairedArc both
direct whole-view fetch + SVG), but `BaseDisplayModel` still carries
`rendererTypeName`/`rendererType` because `LinearBareDisplay`,
`LinearAlignmentsDisplay`, and `BaseLinearDisplay` remain live `CoreRender`
consumers. Once those migrate off server-side block rendering, drop
`rendererTypeName`/`rendererType` from `BaseDisplayModel` and tighten/delete
`CoreRender`/`CoreGetFeatureDetails`.

### MAF UCSC parity — Stage 2

Stage 1 done (e/i line parse+render via Canvas2D overlay; index-based data-volume
gate). The `bigMafSummary` zoom-out machinery has **largely landed** (swappable
`summaryAdapter` frozen sub-adapter slot on `BigMafAdapter`, `LinearMafGetSummaryData`
RPC, `summaryBars` overlay, real fixture `cactus447way.summary.bb`) but is
incomplete. Remaining build work:

- **Coverage band at summary zoom** — currently empty (reads alignment `rpcDataMap`,
  cleared in summary mode). Wire species-count depth, ideally from bigBed zoom levels.
- Deferred: q-line (quality) rendering; e/i for MafTabix/TAF (needs encoding+tooling
  changes, not just viewer).

The summary path and e-lines also need a browser pass — see
[Pending verification](#pending-verification).

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

- The URL wire layer (`buildJb1SessionSpec` + `SessionLoader.ts` props) duplicates
  the param list; it's all-string by nature so it can't share `InitState`'s types.
  Low value — the type sites are already compile-checked against `InitState`.

### Track/Display cleanup (deferred)

Naming is clarified and the legacy block-based render path is kept indefinitely. The
only open item is deleting `BasicTrack` (alias of `FeatureTrack`), which needs a
track-type alias mechanism in `pluggableMstType` + a back-compat test for loading
`BasicTrack` from saved sessions first. Deprioritized — revisit only if the alias
mechanism gets built.

## Pending verification

Scenarios that need a **browser smoke test or manual pass** — the code is written;
this is confirmation, not new work. Test invocation, wait signals, and backend flags
are all in [TEST_INFRASTRUCTURE.md](TEST_INFRASTRUCTURE.md).

### Arc renderer removal

Arcs + semicircles modes render, tooltip works, color/thickness config edits apply
(`pnpm test plugins/arc` covers the unit side).

### MAF summary path (`bigMafSummary` landed, unverified)

- **Summary path pixels + the summary↔detail mode switch** against a real
  summary-configured track (hg38 multiz470way / cactus447way). Species `src` must
  match configured `samples[].id` (`rowIndexBySrc` drops non-matches silently → blank
  bars, not a crash) — first thing to check if zoom-out renders blank.
- **e-lines** — parsing/rendering are unit-tested only; no e/i fixture in repo
  (volvox=MafTabix, evolverMammals=TAF, neither carries e/i). Point a track at a real
  UCSC multiz/cactus `.bb`.

### DisplayChrome (unification landed; confirm jsdom-only changes)

- **Variant force-load cycle** (highest value): zoom to too-large on multi-variant /
  variant-matrix → force load → canvas re-renders cleanly (no blank/detached canvas).
  Proves the old `visibility:hidden` special-casing was artificial (ADR-025).
- **Loading overlay timing**: shows on pan/zoom fetch, hides on first paint; LD with
  triangle toggled off shows NO overlay (empty-state, fetches nothing).
- Run the `browser-tests` GPU-display suites and diff goldens.

### Screenshot review — final cleanup

- Re-review changed shots; run `pnpm review-screenshots-web` to clear verdicts.
- Light caption pass on stale text in `dotplot_view.md:18` and
  `sv_visualization_cgiab.md:246`.
- Open judgment calls: multisv, skbr3_translocation, inverted_duplication captions.

### Known issues to confirm

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
</content>
</invoke>
