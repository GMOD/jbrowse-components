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
- no max height react-app
- persistent no-close cascading submenu for sub-selecting multiple items
- jest "worker failed to exit gracefully" — chase leak with `--detectOpenHandles` / ensure timers `.unref()`
- gccontent track in `config_demo`
- copy and edit track settings
- run `npx fallow --dry-run` and apply recommendations
- choose renderer backend via preferences
- sort by genotype hom/het/ref
- sort by modifications

## Active plans


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

### MAF summary path (`bigMafSummary` landed, unverified)

- **Summary path pixels + the summary↔detail mode switch** against a real
  summary-configured track (hg38 multiz470way / cactus447way). Species `src` must
  match configured `samples[].id` (`rowIndexBySrc` drops non-matches silently → blank
  bars, not a crash) — first thing to check if zoom-out renders blank.
- **e-lines** — parsing/rendering are unit-tested only; no e/i fixture in repo
  (volvox=MafTabix, evolverMammals=TAF, neither carries e/i). Point a track at a real
  UCSC multiz/cactus `.bb`.

### Known issues to confirm

| Issue                             | Status               |
| --------------------------------- | -------------------- |
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


## The SafFire identity "wiggle" — proposal (not built yet)

SafFire draws, per alignment, a horizontal line at y = yscale_c(perid) in the band between the two genome rows — a step-plot of percent identity with its own ~89–100% axis. That maps cleanly onto
LinearSyntenyDisplay: the data already exists (identities + p11/p12 give each block's top-row screen x-extent), so an overlay would draw a segment at y = bandTop + (1 - normIdentity)·bandHeight across
[topMinX, topMaxX].

Two viable paths:
- Canvas2D overlay (recommended first cut) — a thin observer component over the existing synteny canvas reading computedColors/featureData. ~100 lines, no shader work, easy to gate behind a display
toggle + a SafFire-style auto-scaled axis (min(89, dataMin)–100%).
- GPU line pass — a new pass in GpuSyntenyRenderer reusing the instance buffers; faster at whole-genome scale but materially more work (shader + uniforms + the hp-math band geometry).

I held off implementing it because it's a sizable standalone feature (new layout region, axis, toggle) and I didn't want to bundle it into this already-large color change. Want me to build the Canvas2D
version next? It'd slot in as an optional overlay on the linear synteny display.

One note: this touched getWeightedMeans, shared by the PAF/Delta/Chain/MashMap adapters — existing sessions with colorBy: 'meanQueryIdentity' will now show true identity instead of normalized MAPQ.
That's the intended correctness fix, but flagging it as a behavior change.


## Document modifications


 Capture the three-views distinction in the user guide. We did a lot of real-data analysis
  (dorado thresholding, CpG-fill, plant CHH, 5mC/5hmC collapse). A short doc with a screenshot —
  "methylation vs by-type vs bisulfite, when to use each" — would save the next confused user.
  Optional.
