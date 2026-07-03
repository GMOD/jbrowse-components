# Multi-sample variant display — quality/biology enhancement handoff

Handoff for the next agent. Goal: improve UX and surface more biology in the
multi-sample variant displays. This doc captures (a) how the feature works today,
(b) the full menu of improvement ideas that came out of analysis, and (c) a
detailed, agreed implementation plan for the first feature (opt-in
genotype-quality masking).

Read `plugins/variants/src/CLAUDE.md` first — it is the authoritative design doc
(hot-loop rules, invalidation tiers, phased expansion, matrix zoom-cache). Every
plan below is constrained by it.

## The two displays

Both live under `plugins/variants/src/` and share one abstract base:

- `LinearMultiSampleVariantDisplay/` — "regular": one row per sample, variants
  drawn at their true genomic x-position.
- `LinearMultiSampleVariantMatrixDisplay/` — "matrix": sample×site grid packed
  evenly across the full width, with connector lines from each column back to the
  variant's true genomic position (`components/LinesConnectingMatrixToGenomicPosition.tsx`).
- `shared/MultiSampleVariantBaseModel.ts` — ~1130 lines, the bulk of the logic.
  Composed by both via `MultiSampleVariantBaseModelF(configSchema, 'regular'|'matrix')`.
- Config: `shared/SharedVariantConfigSchema.ts` holds every real slot; the
  per-display `configSchema.ts` files only differ in default `height`.
- Renderers per display: `components/GpuVariant*Renderer.ts` (WebGPU/WebGL via
  slang), `Canvas2DVariant*Renderer.ts` (fallback + SVG export),
  `compute*Cells.ts` (worker-side per-cell geometry/color).
- RPC: `VariantRPC/executeVariantCellData.ts` is the monolithic per-viewport
  fetch. `rpcProps()` in the base model is the fetch-input marker.

## Rendering / encodings today

Worker computes one ABGR color per (variant × sample) cell, ships typed arrays,
GPU draws one instanced quad per cell.

- `renderingMode` slot: `alleleCount` (dosage shading, ref `#ccc`, alt darkens
  with dosage via `getAltColorForDosage`) or `phased` (one row per haplotype,
  `set1` palette, PS-hashed hue when FORMAT has PS).
- `featureColor` slot (jexl string): recolors alt-carrying cells; built-in preset
  is consequence impact (`jexl:impactColor(feature)`, `shared/variantConsequence.ts`).
- `referenceDrawingMode` (`draw`/`skip`): skip fills background grey, draws only ALT.
- `colorBy` slot: color sidebar rows by a `samplesTsv` metadata column.
- MAF filter + jexl filters (Edit filters dialog).
- Cluster by genotype (auto via `MultiSampleVariantClusterGenotypeMatrix`, or
  manual R-script paste). Sort rows by one variant's genotype (right-click cell).

## Data fetched but NOT surfaced (the opportunity list)

- **DP/GQ/AD/PL** — the worker reads features but the fast path
  (`feature.processGenotypes`, see `shared/alleleCounts.ts`) only exposes the GT
  substring. Depth/quality never cross the RPC boundary. **This is the biggest
  untapped signal.** Getting it requires the heavy `feature.get('samples')` /
  `variant.SAMPLES()` path (`VcfFeature/index.ts:80,111`) — the same escalation
  the PS coloring already takes (`computeVariantMatrixCells.ts:99`).
- `sampleInfo` (per-sample `maxPloidy` + `isPhased`) is computed and shipped but
  only used internally for haplotype expansion — never shown.
- `mostFrequentAlt`'s allele frequency is computed for the MAF filter, then
  discarded (never shown per-site).
- No pedigree/phenotype/affected-status model at all — "grouping" is a flat
  `colorBy` on arbitrary metadata columns.
- BUG: `shared/buildVariantHit.ts:51` overwrites the real VCF `description` with
  the literal `'multiple ALT alleles'` when `alt.length >= 3`.

## Improvement ideas (ranked, from analysis)

Biology:
- **[chosen first]** Opt-in genotype-quality masking / dimming (DP/GQ) — see plan below.
- VAF coloring from AD (het cells colored by allelic fraction) — turns this into
  a somatic/mosaic cohort viewer. Same worker-side bake-into-`cellColors` approach.
- More `featureColor` presets, cloning the consequence-impact pattern: gnomAD/AF
  rarity (`INFO/AF`/`AF_popmax`), ClinVar `INFO/CLNSIG`, specific SO consequence.
- Pedigree-aware de novo / compound-het / Mendelian-error highlighting (large;
  needs father/mother/affected metadata; highest biological ceiling).
- Per-site summary lane (carrier count / AF / call-rate) in the matrix's existing
  resizable `lineZoneHeight` band.

UX:
- Filter & sort samples by metadata attribute (extend `subtreeFilter`); today you
  can only color by metadata, and sort only by one variant's genotype.
- Matrix connector-line hover shows only `feature.get('name')` and does an
  O(features) `pointToSegmentDist` scan per mousemove — enrich (pos/ref/alt) +
  click-through, and dedupe the repeated `getLineGeometry` calls.
- Matrix ref/no-call cells are silently non-interactive (hover requires a decoded
  genotype, `VariantMatrixComponent.tsx:86`).
- Fix the multiallelic-description overwrite bug above.

## Hard constraints (do not violate)

- **GT-only fast path stays the default and untouched.** Any quality/depth read
  is an opt-in escalation, gated exactly like the PS path. When the feature is
  off, the fetch/compute/payload must be byte-for-byte identical to today.
- **Bake color decisions into the existing `cellColors` `Uint32Array`
  worker-side** (that's where `featureColor` already applies) — no new per-cell
  arrays, no shader change, no client hot-loop change, no bigger payload.
- Hot loops are `for`-indexed, no `.map/.forEach/.find`, no `??`/`||` wrapping
  allocations (see `plugins/variants/src/CLAUDE.md`). Applies to `compute*Cells.ts`.
- Classify every new setting by invalidation tier (fetch input → `rpcProps()`;
  layout input → `sources*`; render input → subclass `renderState`). A
  quality-mask threshold is a **fetch input**.
- `rpcProps()` must not read fetch-derived state (`sampleInfo`, `cellData`,
  `sources`) — use `sourcesBase`.
- Raw DP/GQ/AD *values* for a tooltip should be a lazy single-feature fetch on
  hover (or reuse the click→`VariantSampleGrid` path that already has full
  FORMAT), NOT bulk per-cell arrays.

## Agreed MVP plan: opt-in genotype-quality masking

Semantics: a genotype with `GQ < threshold` renders as **no-call grey** instead
of its allele color. Default threshold `0` = off = today's path. Masking chosen
over continuous dimming for the MVP because it reuses the existing no-call
rendering end-to-end (no shader/legend work) and matches the "don't trust this
call" operation users want. GQ chosen as the first field (standard FORMAT/GQ);
DP is more universal across callers but noisier — revisit after GQ ships.

Files to touch:

- `shared/SharedVariantConfigSchema.ts` — add slot
  `genotypeQualityThreshold: { type: 'number', defaultValue: 0, advanced: true }`.
- `shared/MultiSampleVariantBaseModel.ts` — `get genotypeQualityThreshold()` via
  `getConf`; `setGenotypeQualityThreshold` via `self.configuration.setSlot`; add
  it to `rpcProps()` (the one line that makes it invalidate/refetch correctly);
  add to `PORTABLE_CONFIG_KEYS` so it survives a display-type switch.
- `VariantRPC/types.ts` — add `genotypeQualityThreshold?: number` to `GetCellDataArgs`.
- `VariantRPC/executeVariantCellData.ts` — thread it into both
  `computeVariantCells` and `computeVariantMatrixCells` calls (and pass through
  the RPC method's serialized args).
- `shared/mafFilterUtils.ts` (or a new `genotypeQualityUtils.ts` sibling) — a
  `createGenotypeQualityMenuItem` cloned from `createMAFFilterMenuItem`, added
  under the existing **"Filter by"** submenu (`multiSampleVariantMenuItems.ts`)
  next to MAF. Presets (GQ ≥ 20 / ≥ 30) as radios + a custom dialog; honor the
  "avoid raw number inputs" preference (text `TextField` + `Number.isFinite`, or
  presets).
- `LinearMultiSampleVariantDisplay/components/computeVariantCells.ts` and
  `LinearMultiSampleVariantMatrixDisplay/components/computeVariantMatrixCells.ts`
  — the one perf-sensitive change:
  - `const useQuality = genotypeQualityThreshold > 0`
  - when `false`: loop exactly as today (no behavior change).
  - when `true`: read `feature.get('samples')` per feature (same escalation the
    PS branch already does at `computeVariantMatrixCells.ts:99`), pull GT + GQ
    together, and when `GQ < threshold` color the cell `NO_CALL_COLOR` — or
    substitute `'.'` alleles so the existing allele-count/phased no-call handling
    falls through naturally (prefer the substitution so both modes stay consistent).

Open decision (deferred): should masking also feed the MAF filter (a masked het
shouldn't count toward AF)? Keeping masking coloring-only is the smaller MVP;
coupling is more correct but touches the most perf-sensitive files
(`minorAlleleFrequencyUtils.ts` / `alleleCounts.ts`). Ship independent first,
revisit.

Follow-ups once masking lands (same plumbing): VAF-from-AD coloring, then the
AF/ClinVar `featureColor` presets (cheapest — pure clones of the consequence
preset, no new RPC field).

## Verify

Per `plugins/variants/src/CLAUDE.md`: `pnpm test plugins/variants`, `npx tsgo`
(not tsc). Manually verify in the app that (a) with threshold 0 the render is
identical to today, (b) raising the threshold greys out low-GQ cells and
refetches, (c) a VCF with no GQ degrades gracefully (treat missing GQ as
pass, i.e. don't mask).
