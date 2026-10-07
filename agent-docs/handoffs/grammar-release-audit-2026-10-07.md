---
name: grammar-release-audit-2026-10-07
description: Five parallel audits of the grammar-of-graphics surface before v5.0.0 (schema, vocabulary, mark pipeline, plot write paths, docs and in-repo configs), every finding re-verified against main. Waiting on Colin's call on five shape decisions that are breaking after the release, then the verified defect list is ordinary work. Read before changing a display's grammar slots, the plot write paths or the JSON schema.
---

# Grammar-of-graphics release audit, 2026-10-07

Five Opus investigators ran read-only over main at `c21d633b1d`, one area each;
every finding below was re-read or re-run by the coordinator. Nothing here is
fixed yet. **Delete this file when the calls are made and the defects have
landed or moved to `ideas/`.**

## Direction, as the tree already decided it

The concept objects agree everywhere: every colour object carries ADR-151's
members, `scales.y` is one factory (ADR-142), `facet`/`rows`/`rowColor` are
display-kit's (ADR-157, 160, 207), every display edits them as one `plot`
(ADR-204), retired spellings are one declaration (ADR-171) and the JSON schema
is a second walk of the live objects (ADR-120). All 47 `plotExamples` on the 14
plot-bearing displays round-trip through `plot` → `applyPlot` → session delta →
reload unchanged, and `jbrowse validate` passes all 30 demo configs. What is
left is two displays that still spell a mark their own way, three policy seams
nobody has ruled on, a short defect list, and docs lagging the renames.

## Five calls that are breaking after 5.0.0

1. **Display-level schemas are open.** No display config schema is `closed`
   (`rg "closed: true"` hits only sub-schemas), so
   `{type:'LinearMarkDisplay', totallyBogus:1}` loads and keeps nothing, while
   `encoding.opacity` throws. Both reviewers hit the consequence: a `filterBy`
   typo (`plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts:196`),
   `rows` written on a session display snapshot
   (`website/docs/tutorials/chromhmm.md:316`). Closing them makes a 5.0 app
   refuse a 5.1 key loudly; leaving them open hides every typo until someone
   runs the CLI. Recommendation: close them, and treat cross-version configs as
   the CLI's job.
2. **Merge versus replace is inferred from `shorthand`**
   (`packages/core/src/configuration/getConf.ts:141-146`). `rows` replaces
   whole on wiggle, mark, Manhattan and multi-row (`rowsConfigSchema`) and
   merges member-by-member on MAF and the multi-sample variant display
   (`rowArrangementConfigSchema`), so one share link keeps a clustering tree
   beside an order it no longer lists on one display and switches rows off on
   another. `color` likewise merges on LD and Hi-C alone, because neither
   declares a shorthand. Recommendation: `rows` and every colour object are
   written whole on every display (`shorthand: 'field'` on LD and Hi-C colour,
   the arrangement object treated as one value), leaving `scales` the only
   namespace, and the write mode declared on the schema rather than derived.
3. **Wiggle spells a mark its own way.** `mark: bar|point|line|heatmap`,
   `scoreField`, `size` plus `lineWidth`, `summaryScoreMode: avg`
   (`plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts:108`,
   `packages/wiggle-core/src/scoreFieldConfigSchemaFields.ts:6`,
   `plugins/wiggle/src/shared/wiggleConfigSchemaFields.ts:40,47`) against the
   mark display's `marks[].mark` (`span`, not `heatmap`), `encoding.y`, one
   `encoding.size` and `mean`. None of `mark`, `interpolate`, `size`, `origin`
   is in `PLOT_VOCABULARY`, so Edit plot and the agent API cannot change a
   wiggle's plot type (`liftPlot` throws). Reopens ADR-174's `heatmap`.
   Recommendation: `y`, `size`, `span`, `mean`, and the four slots into the
   vocabulary, retired map for the old names. 1-2 days.
4. **Multi-way synteny orders lanes with a top-level `domain`**
   (`plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/configSchema.ts:103`)
   and keeps the lane subset as session state (`laneFilter`, `model.ts:320`),
   where every row display spells both as `rows: { domain, kept }` (ADR-157).
   Used by `demos/arabidopsis_pangenome` and `test_data/syri`. 1 day.
5. **Grammar-adjacent slots still `frozen`**: `filterBy`, `modifications`,
   `showOutline`, `sortedBy` on the alignments and LGV synteny displays,
   `rowGroups` on multi-row. The schema types them as any JSON, `filterBy` is
   in the plot vocabulary, and `null` on any of them is stored rather than
   reset (`snapshotPreprocess.ts:69`), so `normalizeFilterBy(null)` and
   `compileRowGroups(null)` throw. Typing one after 5.0 refuses configs that
   load today. Recommendation: closed sub-schemas for `filterBy`, `rowGroups`
   and `modifications`, `showOutline` as `maybeBoolean`, `sortedBy` stays
   `maybeFrozen`. 1 day.

Smaller renames in the same class, each a `retired` entry if taken: canvas
`labels.name` → `text` (the third meaning of `labels`,
`plugins/canvas/src/LinearBasicDisplay/baseConfigSchema.ts:140`); LD
`showLabels` boolean → the canvas enum; Manhattan's `ld` field → `r2`
(`plugins/gwas/src/GWASAdapter/ldFields.ts:2`); `scales.y.type` versus
`color.scale` naming one idea two ways (recorded, ADR-151).

Two guards worth adding at the tag: a slot-path baseline from the 5.0.0
`config.json` that `autogen --check` compares against, since the schema deploy
publishes main and a slot removed without a `retired` entry is gone from the URL
next deploy; and the beta-only retired spellings deleted (`linkedReads`,
`useColorPercentile`, the mark display's `displayCrossHatches`/`minimalTicks`).

## Verified defects

Eleven of the twelve landed on 2026-10-07 (the log floor, wiggle's rows enum,
a loose track's `displayDefaults`, the half-written namespace, jb2export's
`marks.N.*` seed, the v4 pileup sort, the haplotype example, Manhattan's
constant colour, a facet over a dropped field, the no-config sample config and
the minors). Left, since it rides on call 2:

- **LD and Hi-C colour refuse the bare-string shorthand** other colour objects
  take (`ldColorConfigSchema.ts:98`, `hicColorConfigSchema.ts:111` declare no
  `shorthand`; MAF's does).

## Docs and in-repo configs behind the code

- `website/docs/config_guides/variant_track.md:209` teaches `LDDisplay`,
  removed in `53bb2b9551`.
- `quantitative_track.md:82` teaches `{ field: "source", scale: "categorical" }`
  on wiggle `color`, which the schema refuses; that is `rowColor`.
- `mark_display.md:161` names `scales.y.autoscale` (now `domainQuantile`);
  `:333` and `slot_types.md:124` say an unset axis `title` derives, where the
  schema draws none (`valueScaleConfigSchema.ts:260`).
- `user_guides/edit_plot.md:25-35` and `agents_live_model.md:193` omit
  `unit`, `y`, LD and the chord display; `BaseDisplayModel.tsx:265` says a
  sub-schema key "replaces the whole object" where namespaces merge; ADR-204
  says LD declares no plot; ADR-120's frozen count is 67 against 69 today.
- `tutorials/chromhmm.md:316` writes `rows` and `height` on a display
  snapshot, which the app drops.
- `automating.md:165` (from `packages/core/src/util/tracks.ts:1146`) shows
  retired `showDescriptions`; `cli.md:283` lists `jexlFilters` for a flag
  whose source says `filter`; jb2export's comparative `--colorBy`
  (`products/jbrowse-img/src/main.ts:155`) names the v4 view key.
- Guides teaching a jexl colour callback where a `color` object draws the
  same picture with a key: `cookbook.md:129,164,449`, `variant_track.md:66`,
  `tracks.md:129`, `faq.md:145`, `customizing_feature_colors.md:7,93`.
- Configs: `demos/ecoli_pangenome` `showLabels: false` (4 tracks);
  `test_data/config_demo.json` tracks 19, 20, 253 and `test_data/tcga_cnv`
  carry `renderer.color1`/`renderer.labels`; `test_data/cfam2` and
  `sars-cov2` sessions carry `heightPreConfig`;
  `scripts/agent-demos/takes/synteny.md:108` teaches `colorBy`.
- Undocumented grammar slots: multi-way `laneLayers` and `text`, the mark
  display's `rowColor`, MAF's `rows`/`rowColor`/`y` in the config guide,
  alignments `unit`/`arcColor`/`facet` in the config guide.

## Checker blind spots that let the above ship

`check-config-blocks.ts:207` keeps errors only (an unregistered display type is
a warning); display and `marks` fragments, JSON in tables, session fences,
commented JSON and the generated `config/` pages are never validated; the CLI
README is regenerated only on prepack. `jbrowse validate` also warns wrongly on
a categorical `displayDefaults.color` on a FeatureTrack, because it checks the
colour against the wiggle display's `'*': threshold` preset too
(`cookbook.md:226`).

## Settled, not findings

Colour-object members and `scale: 'none'` agree on every display;
`fieldPresets` names agree (`strand`, `identity`, `mapq`, `count`, `r2`,
`dprime`); the CLI's rule-list copy is byte-identical to the live one and
guarded by autogen; every shorthand has its schema branch; `null` resets agree
across paths on typed slots; SVG export shares the Canvas2D painters so no mark
lacks a twin; `startEnd` is render-core's, not config vocabulary; a new mark,
step type, scale kind, colour member or display type is additive in the schema
(the `if/then` dispatch passes unknown types); `displayDefaults` expand into
the display config so `plot` and "Reset track settings" see them; alignments
`layoutOrder`/`sortedBy` are not a second spelling of `rows.domain`, since
pileup rows have no keys; `displayMode`, `lodMode`, `conservationMode`,
`heightMode` are honest layout or fetch modes.
